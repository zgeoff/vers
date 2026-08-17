import { expect, onTestFinished, test } from 'bun:test';
import type { ErrorEvent } from '@sentry/browser';
import { ActivityFailureAction } from '@vers/idle-core';
import { createAuthedServiceClient, createViewer, resolveServiceURL } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { waitFor } from '@vers/test-utils';
import { http } from 'msw';
import invariant from 'tiny-invariant';
import { server } from '../mocks/node';
import { readPendingStartIntent } from '../submission/read-pending-start-intent';
import { readPendingStopIntent } from '../submission/read-pending-stop-intent';
import type { ActivityServiceClient } from '../submission/types';
import { writeFailureActionCache } from '../submission/write-failure-action-cache';
import { writeNodeSeeds } from '../submission/write-node-seeds';
import { writePendingStartIntent } from '../submission/write-pending-start-intent';
import { writePendingStopIntent } from '../submission/write-pending-stop-intent';
import { writeQueuedCheckpoint } from '../submission/write-queued-checkpoint';
import { writeStartStamps } from '../submission/write-start-stamps';
import { createFastClock } from '../test-utils/create-fast-clock';
import { createTestClient } from '../test-utils/create-test-client';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { makeFailFirstMatchHandler } from '../test-utils/make-fail-first-match-handler';
import { WORKER_TO_CLIENT_CHANNEL } from '../transport/constants';
import { WorkerMessageType } from '../types';
import { createWorkerRuntime } from './create-worker-runtime';
import type { WorkerRuntime } from './create-worker-runtime';
import { sentryHandle } from './sentry-handle';
import { startErrorReporting } from './start-error-reporting';

/**
 * Records every broadcast the runtime posts, in arrival order — the state channel a
 * `MessagePort`-based test client never sees, since it now rides `BroadcastChannel` regardless of
 * transport.
 */
function collectBroadcasts() {
  const channel = new BroadcastChannel(WORKER_TO_CLIENT_CHANNEL);

  onTestFinished(() => {
    channel.close();
  });

  const received: Array<unknown> = [];

  channel.addEventListener('message', (event: MessageEvent<unknown>) => {
    received.push(event.data);
  });

  return {
    received,
    waitForMessages: async (count: number) => {
      await waitFor(() => {
        expect(received.length).toBeGreaterThanOrEqual(count);
      });
    },
  };
}

function createConnectedTestClient(runtime: WorkerRuntime) {
  const testClient = createTestClient();

  runtime.handleConnect(new MessageEvent('connect', { ports: [testClient.port] }));

  return testClient.client;
}

test('it answers initialize with the current state', async () => {
  using runtime = createWorkerRuntime();

  const client = createConnectedTestClient(runtime);

  const result = await client.initialize({});

  expect(result.writerDisplacedActivityID).toBeNull();
  expect(result.rewardSlotLedger).toStrictEqual({ activityID: null, entries: [] });
});

test('it seeds the boot state from the device-local failure-action cache before the first call runs', async () => {
  await writeFailureActionCache({
    avatarID: 'seeded-avatar',
    dirty: true,
    failureAction: ActivityFailureAction.Retry,
  });

  using runtime = createWorkerRuntime();

  const client = createConnectedTestClient(runtime);

  const result = await client.initialize({});

  expect(result.state.failureAction).toBe(ActivityFailureAction.Retry);
});

test('it retains the cached dirty flag across boot so the next resync flushes it to the server', async () => {
  const viewer = await createViewer();

  await db.activityCollection.create({
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    startedAt: new Date(),
  });

  await writeFailureActionCache({
    avatarID: viewer.avatar.id,
    dirty: true,
    failureAction: ActivityFailureAction.Retry,
  });

  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  using runtime = createWorkerRuntime({ client });

  const testClient = createConnectedTestClient(runtime);

  await testClient.reportOnline({ avatarID: viewer.avatar.id, claim: false });

  await waitFor(() => {
    const updatedAvatar = db.avatarCollection.findFirst((q) => q.where({ id: viewer.avatar.id }));

    expect(updatedAvatar?.failureAction).toBe('retry');
  });
});

test('it broadcasts a simulation update once a started run installs', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  // a start is always a local mint, so the node's start inputs must already be cached — as
  // useSeedPrefetch would have relayed them from a real revealNodes round trip — and the content
  // document its encounter derived against must be published for the install's own load to find
  await db.contentDocumentCollection.create({ contentVersion: '2' });

  const revealed = await client.revealNodes({ avatarID: viewer.avatar.id, nodeIDs: ['1_0'] });

  await writeNodeSeeds(viewer.avatar.id, revealed.nodes);

  await writeStartStamps({
    keyVersion: revealed.keyVersion,
    secretRef: revealed.secretRef,
    secretVersion: revealed.secretVersion,
  });

  using runtime = createWorkerRuntime({ bundledEngineHash: 'test_engine_hash', client });

  const broadcasts = collectBroadcasts();
  const testClient = createConnectedTestClient(runtime);

  await testClient.initialize({});

  const status = await testClient.startActivity({
    avatarID: viewer.avatar.id,
    scopeID: '1_0',
    scopeType: 'world_map_node',
  });

  expect(status.kind).toBe('started');

  await broadcasts.waitForMessages(1);

  expect(broadcasts.received).toPartiallyContain({ type: WorkerMessageType.SimulationUpdate });
});

test('it closes the connection on disconnect so no further call it makes is answered', async () => {
  using runtime = createWorkerRuntime();

  const client = createConnectedTestClient(runtime);

  await client.disconnect({});

  // the close itself is deferred a macrotask past the disconnect call's own answer, so this
  // outlasts that race before proving the connection is dead
  await new Promise((resolve) => {
    setTimeout(resolve, 50);
  });

  const answered = (async () => {
    await client.initialize({});

    return 'answered' as const;
  })();

  const timedOut = new Promise<'timed-out'>((resolve) => {
    setTimeout(() => {
      resolve('timed-out');
    }, 100);
  });

  const raced = await Promise.race([answered, timedOut]);

  expect(raced).toBe('timed-out');
});

test('it resumes into a fresh row once a same-row CONFLICT resync drains a held terminal append', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  // this seed's placeholder encounter completes in exactly 60s of simulated time; the fast clock
  // below collapses that wait into a single tick-loop frame. A zero-gap active row makes the
  // resync below attach it live — the tab-side install path now that only the worker sets
  // activities.
  const activity = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    encounterNode: { difficulty: 1 },
    seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
    startedAt: new Date(),
  });

  // holds this activity's terminal append once: the row it closes stays active server-side, so
  // the continuation's own startActivity call races back a same-row CONFLICT
  server.use(
    http.post(
      `${resolveServiceURL('activity')}/rpc/trackActivityProgress`,
      makeFailFirstMatchHandler((input) => input['activityID'] === activity.id),
    ),
  );

  const clock = createFastClock();

  using runtime = createWorkerRuntime({ client, now: clock.now });

  const testClient = createConnectedTestClient(runtime);

  await testClient.initialize({});
  await testClient.reportOnline({ avatarID: viewer.avatar.id, claim: false });

  await waitFor(
    () => {
      // re-armed every poll: a jump that lands before the tick loop installs the simulation is an
      // idle frame, so the wait just re-arms the next one until it lands on a live tick
      clock.jump(65_000);

      const minted = db.activityCollection.findFirst((q) =>
        q.where({ avatarID: viewer.avatar.id, status: 'active' }),
      );

      invariant(minted !== undefined, 'expected the same-row CONFLICT resync to mint a fresh row');

      expect(minted.id).not.toBe(activity.id);
    },

    // the tick loop paces itself on real timers between each of the many timesteps this jump
    // spans, so a loaded runner can need several times the default budget to land a live tick
    { timeoutMs: 5000 },
  );

  const closed = db.activityCollection.findFirst((q) => q.where({ id: activity.id }));

  invariant(closed !== undefined, 'expected the seeded activity to still exist');

  expect(closed.status).toBe('stopped');
});

test('it resumes into a fresh row once a reconnect drains a held terminal append behind an offline continuation', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  // this seed's placeholder encounter completes in exactly 60s of simulated time; the fast clock
  // below collapses that wait into a single tick-loop frame. A zero-gap active row makes the
  // resync below attach it live — the tab-side install path now that only the worker sets
  // activities.
  const activity = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    encounterNode: { difficulty: 1 },
    seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
    startedAt: new Date(),
  });

  // both this activity's terminal append and its continuation's own startActivity call fail once,
  // standing in for the device going offline right as the run completes; the flag scripts the
  // handler sequence and doubles as the only observable that the append actually failed
  let appendFailed = false;

  server.use(
    http.post(
      `${resolveServiceURL('activity')}/rpc/trackActivityProgress`,
      makeFailFirstMatchHandler((input) => {
        if (input['activityID'] !== activity.id) {
          return false;
        }

        appendFailed = true;

        return true;
      }),
    ),
    http.post(
      `${resolveServiceURL('activity')}/rpc/startActivity`,
      makeFailFirstMatchHandler((input) => input['avatarID'] === viewer.avatar.id),
    ),
  );

  const clock = createFastClock();

  using runtime = createWorkerRuntime({ client, now: clock.now });

  const testClient = createConnectedTestClient(runtime);

  await testClient.initialize({});
  await testClient.reportOnline({ avatarID: viewer.avatar.id, claim: false });

  await waitFor(
    () => {
      // re-armed every poll: a jump that lands before the tick loop installs the simulation is an
      // idle frame, so the wait just re-arms the next one until it lands on a live tick
      clock.jump(65_000);

      expect(appendFailed).toBeTrue();
    },

    // the tick loop paces itself on real timers between each of the many timesteps this jump
    // spans, so a loaded runner can need several times the default budget to land a live tick
    { timeoutMs: 5000 },
  );

  globalThis.dispatchEvent(new Event('online'));

  await waitFor(() => {
    const minted = db.activityCollection.findFirst((q) =>
      q.where({ avatarID: viewer.avatar.id, status: 'active' }),
    );

    invariant(minted !== undefined, 'expected the reconnect resync to mint a fresh row');

    expect(minted.id).not.toBe(activity.id);
  });

  const closed = db.activityCollection.findFirst((q) => q.where({ id: activity.id }));

  invariant(closed !== undefined, 'expected the seeded activity to still exist');

  expect(closed.status).toBe('stopped');
});

test('it drops a held start intent as stale on reconnect and resumes the remembered avatar instead', async () => {
  const viewer = await createViewer();
  const avatar = await db.avatarCollection.create({ userID: viewer.user.id });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  // the intent's source row already reads closed; a stale-dropped intent must mint nothing here
  const source = await db.activityCollection.create({
    avatarID: avatar.id,
    status: 'stopped',
  });

  // a capped row makes each resync's completion observable: it plans a rebase and emits a
  // capped status, installing nothing — the reconnect gate below still sees no simulation
  await db.activityCollection.create({
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    status: 'capped',
  });

  using runtime = createWorkerRuntime({ client });

  const broadcasts = collectBroadcasts();
  const testClient = createConnectedTestClient(runtime);

  // the worker remembers this avatar as its last resync target once the report's recovery runs
  await testClient.reportOnline({ avatarID: viewer.avatar.id, claim: false });

  await waitFor(() => {
    expect(broadcasts.received).toPartiallyContain({
      status: { kind: 'capped' },
      type: WorkerMessageType.ResyncStatus,
    });
  });

  // parked while offline, for an avatar the account is no longer playing as
  await writePendingStartIntent({
    activityID: source.id,
    avatarID: avatar.id,
    scopeID: source.scopeID,
    scopeType: source.scopeType,
  });

  globalThis.dispatchEvent(new Event('online'));

  // The server names the remembered avatar as the account's real active one, so a fallback pass
  // runs for it in the same call — its own `capped` status broadcasts first, then
  // `avatar-switched` broadcasts as the cycle's terminal status, carrying that pass's (zero)
  // tallies.
  await waitFor(async () => {
    const heldIntent = await readPendingStartIntent();

    expect(heldIntent).toBeUndefined();
  });

  await waitFor(() => {
    expect(broadcasts.received.at(-1)).toStrictEqual({
      status: {
        activeAvatarName: viewer.avatar.name,
        attempts: 0,
        kind: 'avatar-switched',
        levelUps: 0,
      },
      type: WorkerMessageType.ResyncStatus,
    });
  });

  const minted = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: avatar.id, status: 'active' }),
  );

  expect(minted).toBeUndefined();
});

test('it recovers a stop parked offline once a flush answer proves the connection returned', async () => {
  const viewer = await createViewer();
  const avatarB = await db.avatarCollection.create({ userID: viewer.user.id });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  // this seed's placeholder encounter completes in exactly 60s of simulated time, so the terminal
  // append is the first flush traffic after the offline window below
  const activity = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    encounterNode: { difficulty: 1 },
    seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
    startedAt: new Date(),
  });

  const clock = createFastClock();

  using runtime = createWorkerRuntime({ client, now: clock.now });

  const broadcasts = collectBroadcasts();
  const testClient = createConnectedTestClient(runtime);

  await testClient.initialize({});
  await testClient.reportOnline({ avatarID: viewer.avatar.id, claim: true });

  // small re-armed jumps drive live ticks until the attach's simulation broadcasts, staying far
  // short of the encounter's 60s completion so no flush traffic lands before the offline window
  await waitFor(() => {
    clock.jump(1000);

    const update = broadcasts.received.findLast(
      (message): message is { state: { activity?: { id: string } }; type: string } =>
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === WorkerMessageType.SimulationUpdate,
    );

    expect(update?.state.activity?.id).toBe(activity.id);
  });

  globalThis.dispatchEvent(new Event('offline'));

  // parked while the tracked state reads offline, for the other avatar so no flow of the live
  // run's own — continuation or inline resync — can deliver it; only the server-contact
  // recovery flushes a pending stop outside a resync
  const other = await db.activityCollection.create({ avatarID: avatarB.id, status: 'active' });

  await writePendingStopIntent({ activityID: other.id, avatarID: avatarB.id });

  await waitFor(
    () => {
      // re-armed every poll until the jump lands on a live tick and the terminal append flushes
      clock.jump(65_000);

      const stopped = db.activityCollection.findFirst((q) => q.where({ id: other.id }));

      invariant(stopped !== undefined, "expected the parked stop's row to survive");

      expect(stopped.status).toBe('stopped');
    },

    // the tick loop paces itself on real timers between each of the many timesteps this jump
    // spans, so a loaded runner can need several times the default budget to land a live tick
    { timeoutMs: 5000 },
  );
});

test('it cancels an in-flight resync read on stop() without stopping the row back or reporting a fault', async () => {
  const previousHandle = sentryHandle.current;
  const recorded: Array<Readonly<ErrorEvent>> = [];

  onTestFinished(() => {
    sentryHandle.current = previousHandle;
  });

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    disableDefaultIntegrations: true,
  });

  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const activity = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    status: 'active',
  });

  let notifyReadStarted: (() => void) | undefined;

  const readStarted = new Promise<void>((resolve) => {
    notifyReadStarted = resolve;
  });

  // hangs forever on its own — only stop()'s abort settles the call the runtime is waiting on
  server.use(
    mockActivityService.getLatestActivityProgress.handler(() => {
      notifyReadStarted?.();

      return new Promise(() => {});
    }),
  );

  using runtime = createWorkerRuntime({ client });

  const testClient = createConnectedTestClient(runtime);

  await testClient.initialize({});

  // not awaited — the call's own resync read is what the mock above hangs, and only stop()'s
  // abort settles it
  void testClient.reportOnline({ avatarID: viewer.avatar.id, claim: false });

  await readStarted;

  runtime.stop();

  // a start queued behind the resync's lifecycle turn only runs once that turn settles — its own
  // entry check sees the now-permanently-aborted cancel signal and answers failed, proving the
  // cancelled read didn't strand it hanging on the mailbox
  const status = await testClient.startActivity({
    avatarID: 'stop-cancel-avatar',
    scopeID: '7_0',
    scopeType: 'world_map_node',
  });

  expect(status.kind).toBe('failed');
  expect(recorded).toStrictEqual([]);

  const row = db.activityCollection.findFirst((q) => q.where({ id: activity.id }));

  invariant(row !== undefined, 'expected the seeded row to survive shutdown');

  expect(row.status).toBe('active');

  const pendingStop = await readPendingStopIntent();

  expect(pendingStop).toBeUndefined();
});

test('it resets the displaced simulation and broadcasts WriterDisplaced on a session eviction', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  // a zero-gap active row, so the first reconnect's resync attaches it live without any
  // simulated time elapsing
  const activity = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    encounterNode: { difficulty: 1 },
    seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
    startedAt: new Date(),
  });

  const broadcasts = collectBroadcasts();

  using runtime = createWorkerRuntime({ client });

  const testClient = createConnectedTestClient(runtime);

  await testClient.initialize({});

  // the report awaits the recovery it triggers, so the resync's attach has fully settled by the
  // time it answers — the run is genuinely installed before the takeover happens
  await testClient.reportOnline({ avatarID: viewer.avatar.id, claim: false });

  const installed = await testClient.initialize({});

  expect(installed.state.activity).toMatchObject({ id: activity.id });

  // the takeover: from here every append is refused as another session's, and a checkpoint is
  // already queued for the reconnect drain below to deliver into that refusal
  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      throw opts.errors.SESSION_EVICTED({ data: {} });
    }),
  );

  await writeQueuedCheckpoint(activity.id, createMockCheckpointBatchEntry({ version: 1 }));

  // the second connectivity report drains the held queue; its flush answers the eviction, and the
  // displacement settles as its own lifecycle flow
  await testClient.reportOnline({ avatarID: viewer.avatar.id, claim: false });

  await waitFor(() => {
    expect(broadcasts.received).toPartiallyContain({
      activityID: activity.id,
      type: WorkerMessageType.WriterDisplaced,
    });
  });

  const result = await testClient.initialize({});

  expect(result.writerDisplacedActivityID).toBe(activity.id);

  // the displaced run's simulation is cleared, not just announced — the fresh snapshot carries no
  // activity
  expect(result.state.activity).toBeUndefined();
});
