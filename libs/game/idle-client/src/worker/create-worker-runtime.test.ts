import { expect, onTestFinished, test } from 'bun:test';
import type { ErrorEvent } from '@sentry/browser';
import {
  createMockActivityData,
  createMockContentDocument,
} from '@vers/contract-activity/test-utils';
import { ActivityFailureAction } from '@vers/idle-core';
import { createAuthedServiceClient, createViewer, resolveServiceURL } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { waitFor } from '@vers/test-utils';
import { http } from 'msw';
import invariant from 'tiny-invariant';
import { writeContentDocumentCache } from '../content/write-content-document-cache';
import { server } from '../mocks/node';
import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { readPendingStopIntent } from '../submission/read-pending-stop-intent';
import type { ActivityServiceClient } from '../submission/types';
import { writeFailureActionCache } from '../submission/write-failure-action-cache';
import { writeNodeSeeds } from '../submission/write-node-seeds';
import { writePendingStopIntent } from '../submission/write-pending-stop-intent';
import { writeQueuedCheckpoint } from '../submission/write-queued-checkpoint';
import { writeStartStamps } from '../submission/write-start-stamps';
import { createFastClock } from '../test-utils/create-fast-clock';
import { createTestClient } from '../test-utils/create-test-client';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { createMockLatestActivityProgress } from '../test-utils/factories/create-mock-latest-activity-progress';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { makeFailFirstMatchHandler } from '../test-utils/make-fail-first-match-handler';
import { WORKER_TO_CLIENT_CHANNEL } from '../transport/constants';
import { WorkerMessageType } from '../types';
import { createWorkerRuntime } from './create-worker-runtime';
import type { WorkerRuntime } from './create-worker-runtime';
import { sentryHandle } from './sentry-handle';
import { startErrorReporting } from './start-error-reporting';

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

test('it resumes into a fresh row once a reconnect drains a held terminal append behind an offline continuation', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  // this seed's placeholder encounter completes in exactly 60s of simulated time; the fast clock
  // below collapses that wait into one tick-loop frame, and a zero-gap active row makes the
  // resync attach it live
  const activity = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    encounterNode: { difficulty: 1 },
    scopeID: '0_0',
    seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
    startedAt: new Date(),
  });

  // the continuation mints from this device's cache, so the scope's inputs must be present
  await writeNodeSeeds(viewer.avatar.id, [
    createMockNodeSeed({
      avatarID: viewer.avatar.id,
      contentVersion: '2',
      encounterNode: { difficulty: 1 },
      nodeID: '0_0',
    }),
  ]);

  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

  // the install loads the pinned document; publishing it keeps the test off whatever a cache miss
  // would fetch
  await writeContentDocumentCache(createMockContentDocument({ contentVersion: '2' }));

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
  );

  const clock = createFastClock();

  using runtime = createWorkerRuntime({
    bundledEngineHash: 'engine_hash_1',
    client,
    now: clock.now,
  });

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

  await waitFor(async () => {
    const pending = await readAllActivityStarts();

    const minted = pending.find((row) => row.predecessorActivityID === activity.id);

    invariant(minted !== undefined, 'expected the reconnect to mint a fresh row');

    expect(minted.id).not.toBe(activity.id);
  });
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

  // the takeover modeled consistently: every append is refused and the fetched progress reports
  // the writer lost, so a resync the recovery runs plans active-elsewhere instead of re-attaching
  // a row the server would refuse; a queued checkpoint delivers into that refusal below
  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      throw opts.errors.SESSION_EVICTED({ data: {} });
    }),
    mockActivityService.getLatestActivityProgress.handler(() =>
      createMockLatestActivityProgress({
        activity: { ...createMockActivityData(), avatarID: viewer.avatar.id, id: activity.id },
        isWriter: false,
      }),
    ),
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

test('it answers a debug snapshot that records a connectivity loss the platform reports', async () => {
  using runtime = createWorkerRuntime();

  const client = createConnectedTestClient(runtime);

  self.dispatchEvent(new Event('offline'));

  const snapshot = await client.readDebugSnapshot({});

  expect(snapshot).toMatchObject({
    connectivityOnline: false,
    events: [{ detail: 'offline', type: 'connectivity' }],
    latestRun: null,
    liveRun: null,
    outbox: { activityStarts: [], checkpoints: [] },
    phase: 'idle',
  });

  expect(snapshot.writer.workerID).toBeString();
});

test('it records the resync a fresh worker runs ahead of its first start in the debug snapshot', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  await db.contentDocumentCollection.create({ contentVersion: '2' });

  const revealed = await client.revealNodes({ avatarID: viewer.avatar.id, nodeIDs: ['1_0'] });

  await writeNodeSeeds(viewer.avatar.id, revealed.nodes);

  await writeStartStamps({
    keyVersion: revealed.keyVersion,
    secretRef: revealed.secretRef,
    secretVersion: revealed.secretVersion,
  });

  using runtime = createWorkerRuntime({ bundledEngineHash: 'test_engine_hash', client });

  const testClient = createConnectedTestClient(runtime);

  await testClient.initialize({});

  const status = await testClient.startActivity({
    avatarID: viewer.avatar.id,
    scopeID: '1_0',
    scopeType: 'world_map_node',
  });

  expect(status.kind).toBe('started');

  const snapshot = await testClient.readDebugSnapshot({});

  const phases = snapshot.events
    .filter((event) => event.type === 'lifecycle')
    .map((event) => event.detail);

  expect(phases).toStrictEqual(['resyncing', 'starting', 'running']);
  expect(snapshot.events).toPartiallyContain({ detail: '1_0 started', type: 'start' });
});

test('it runs twenty fixed steps per real-time step at speed 20 and writes the checkpoint stream a real-time run writes', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  // this seed's placeholder encounter completes in exactly 60s of simulated time; the hashes are
  // pinned so the stream links from the same start whichever row a run attaches to
  const activity = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    encounterNode: { difficulty: 1 },
    lastHash: 'a'.repeat(64),
    seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
    startHash: 'b'.repeat(64),
    startedAt: new Date(),
  });

  const clock = createFastClock();

  using runtime = createWorkerRuntime({ client, now: clock.now });

  const testClient = createConnectedTestClient(runtime);

  await testClient.initialize({});

  // the report awaits the recovery it triggers, so the zero-gap row is attached live and sits at
  // no simulated time when it answers
  await testClient.reportOnline({ avatarID: viewer.avatar.id, claim: true });

  const attached = await testClient.initialize({});

  expect(attached.state.activity).toMatchObject({ elapsed: 0, id: activity.id });

  const status = await testClient.setSimulationSpeed({ isQAAvatar: true, speed: 20 });

  expect(status).toStrictEqual({ kind: 'applied', speed: 20 });

  clock.jump(1000);

  // one second of wall clock is twenty seconds of simulated time; the run's clock reads one fixed
  // step behind the frame because the engine yields the Started checkpoint before it starts it
  await waitFor(
    async () => {
      const current = await testClient.initialize({});

      expect(current.state.activity?.elapsed).toBe(19_950);
    },

    // the frame runs four hundred fixed steps, each awaiting its own tick, so a loaded runner can
    // need several times the default budget to finish it
    { timeoutMs: 5000 },
  );

  await waitFor(
    () => {
      // re-armed every poll until the jump lands on a live tick and the terminal append flushes;
      // one landing carries the run past its 60s completion
      clock.jump(2250);

      const stopped = db.activityCollection.findFirst((q) => q.where({ id: activity.id }));

      invariant(stopped !== undefined, 'expected the attached row to survive the run');

      expect(stopped.status).toBe('stopped');
    },

    // the tick loop paces itself on real timers between each of the many timesteps this jump
    // spans, so a loaded runner can need several times the default budget to land a live tick
    { timeoutMs: 5000 },
  );

  const stream = db.checkpointCollection
    .findMany((q) => q.where({ activityID: activity.id }))
    .toSorted((a, b) => a.version - b.version)
    .map((checkpoint) => ({
      chainIndex: checkpoint.payload.chainIndex,
      hash: checkpoint.hash,
      time: checkpoint.payload.time,
      type: checkpoint.payload.type,
      version: checkpoint.version,
    }));

  expect(stream).toMatchInlineSnapshot(`
    [
      {
        "chainIndex": 1,
        "hash": "b9f607a83348ea06776f36f8c237ccb477b5dcb88b13e9f0eb12eed87e3ab3d4",
        "time": 0,
        "type": "started",
        "version": 1,
      },
      {
        "chainIndex": 2,
        "hash": "0d42348c3abb6a8376ab4ed8e609128b4648812348caf62279125902dffdb85e",
        "time": 2500,
        "type": "progress",
        "version": 2,
      },
      {
        "chainIndex": 3,
        "hash": "2097b0685292037f1ec84130500dd3a1d3fa3a2863904799ffdce8fa8056a1f8",
        "time": 3750,
        "type": "progress",
        "version": 3,
      },
      {
        "chainIndex": 4,
        "hash": "e4832c5538db11a6fce54b181e18c9c36a44d756f4f478b242a2fe79174944d2",
        "time": 7500,
        "type": "progress",
        "version": 4,
      },
      {
        "chainIndex": 5,
        "hash": "470fa1c0e352db39632a33061bfa2e439dd6ac2f1f662faf947a49468cb537ba",
        "time": 11250,
        "type": "progress",
        "version": 5,
      },
      {
        "chainIndex": 6,
        "hash": "b8235b9374ecf2933c91f8fe5530a47fa9fe8839282e1022fe320a942ce1c189",
        "time": 15000,
        "type": "progress",
        "version": 6,
      },
      {
        "chainIndex": 7,
        "hash": "2aca4a9a87601995af3170e6df46f7942c7b5a3bc0f8b4d4caffe1bb83c1a813",
        "time": 18750,
        "type": "progress",
        "version": 7,
      },
      {
        "chainIndex": 8,
        "hash": "0d75ce48fd5a0ec2bce3122bc4bbd5323c206888d3ac1d47f8ab62e9d66af819",
        "time": 21250,
        "type": "progress",
        "version": 8,
      },
      {
        "chainIndex": 9,
        "hash": "45d08011b788c7b43a6e2858d4cd4b4ebe1d479825869cfb4046ba8e732bcfcc",
        "time": 25000,
        "type": "progress",
        "version": 9,
      },
      {
        "chainIndex": 10,
        "hash": "c95928929bfb0a416aeb560a7f6f02aff2c30c1342668a702024acb151c0d8ac",
        "time": 27500,
        "type": "progress",
        "version": 10,
      },
      {
        "chainIndex": 11,
        "hash": "7ef1af731cbca24c2ec37a2b1c085553cd5f96b5f3ecf4866087c9ef54779461",
        "time": 30000,
        "type": "progress",
        "version": 11,
      },
      {
        "chainIndex": 12,
        "hash": "25cdf7f8a1df88a12b4c76bdf7e17a77f0db395364bda663d115f1a15e059bc0",
        "time": 33750,
        "type": "progress",
        "version": 12,
      },
      {
        "chainIndex": 13,
        "hash": "e0748114d81b13f777d23505356426e8b5e7b3a02e7c26fe55e3e22f311c2414",
        "time": 35000,
        "type": "progress",
        "version": 13,
      },
      {
        "chainIndex": 14,
        "hash": "2887c3a87720b7bf9ab26a3c1b6cc6982667c1458d6582e0b9e7f31680983ce1",
        "time": 37500,
        "type": "progress",
        "version": 14,
      },
      {
        "chainIndex": 15,
        "hash": "c4581165d418d23f82220590a6368eec8fe1f2ff64ac221da4322fac19822028",
        "time": 40000,
        "type": "progress",
        "version": 15,
      },
      {
        "chainIndex": 16,
        "hash": "6ce6242499785717015e530ca209c8ff3e071b563eeacd43e95aa4f9abc84bc3",
        "time": 42500,
        "type": "progress",
        "version": 16,
      },
      {
        "chainIndex": 17,
        "hash": "55051dcbb66ac44c0e7bba16fef85b8f1bbf10499e2b3a16da1efeb76e8e8d5b",
        "time": 45000,
        "type": "progress",
        "version": 17,
      },
      {
        "chainIndex": 18,
        "hash": "cf79c2ba50a32468b3f6f7af66d9b613abf79be5c1f2225bfb78f72c1370fdd8",
        "time": 47500,
        "type": "progress",
        "version": 18,
      },
      {
        "chainIndex": 19,
        "hash": "209ea7503e10607cbbce55b785595546a3b49ea8ddbf3f71ce3b10ceb42da8e9",
        "time": 50000,
        "type": "progress",
        "version": 19,
      },
      {
        "chainIndex": 20,
        "hash": "399fc5839dd392a4215a078c632988b159a15e396f9adda05d346b495acb2bea",
        "time": 52500,
        "type": "progress",
        "version": 20,
      },
      {
        "chainIndex": 21,
        "hash": "645a3089b11e47cbd1a35565db6a0750b47e7c53add9816ac442100a8bfb1d03",
        "time": 55000,
        "type": "progress",
        "version": 21,
      },
      {
        "chainIndex": 22,
        "hash": "123c2126509544910162ac63de6b97dac3fe7409ec416178692b2b3ca869e761",
        "time": 57500,
        "type": "progress",
        "version": 22,
      },
      {
        "chainIndex": 23,
        "hash": "5d7eace6c117d4d38a9c9d0ac2004da6b723b3e749dd9cd8d9f357f963055f23",
        "time": 60000,
        "type": "progress",
        "version": 23,
      },
      {
        "chainIndex": 24,
        "hash": "e90d3e62164200bfec7f2940cde935cc075a6801b4a7fad71e847fc3807ca8f0",
        "time": 60000,
        "type": "completed",
        "version": 24,
      },
    ]
  `);
});

test('it writes the same checkpoint stream at real time as a speed-20 run on the same seed', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const activity = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    encounterNode: { difficulty: 1 },
    lastHash: 'a'.repeat(64),
    seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
    startHash: 'b'.repeat(64),
    startedAt: new Date(),
  });

  const clock = createFastClock();

  using runtime = createWorkerRuntime({ client, now: clock.now });

  const testClient = createConnectedTestClient(runtime);

  await testClient.initialize({});
  await testClient.reportOnline({ avatarID: viewer.avatar.id, claim: true });

  const attached = await testClient.initialize({});

  expect(attached.state.activity).toMatchObject({ elapsed: 0, id: activity.id });

  clock.jump(20_000);

  // twenty seconds of wall clock is twenty seconds of simulated time, read one fixed step behind
  // the frame for the same reason the speed-20 run reads it
  await waitFor(
    async () => {
      const current = await testClient.initialize({});

      expect(current.state.activity?.elapsed).toBe(19_950);
    },

    // the frame runs four hundred fixed steps, each awaiting its own tick, so a loaded runner can
    // need several times the default budget to finish it
    { timeoutMs: 5000 },
  );

  await waitFor(
    () => {
      // re-armed every poll until the jump lands on a live tick and the terminal append flushes
      clock.jump(45_000);

      const stopped = db.activityCollection.findFirst((q) => q.where({ id: activity.id }));

      invariant(stopped !== undefined, 'expected the attached row to survive the run');

      expect(stopped.status).toBe('stopped');
    },

    // the tick loop paces itself on real timers between each of the many timesteps this jump
    // spans, so a loaded runner can need several times the default budget to land a live tick
    { timeoutMs: 5000 },
  );

  const stream = db.checkpointCollection
    .findMany((q) => q.where({ activityID: activity.id }))
    .toSorted((a, b) => a.version - b.version)
    .map((checkpoint) => ({
      chainIndex: checkpoint.payload.chainIndex,
      hash: checkpoint.hash,
      time: checkpoint.payload.time,
      type: checkpoint.payload.type,
      version: checkpoint.version,
    }));

  expect(stream).toMatchInlineSnapshot(`
    [
      {
        "chainIndex": 1,
        "hash": "b9f607a83348ea06776f36f8c237ccb477b5dcb88b13e9f0eb12eed87e3ab3d4",
        "time": 0,
        "type": "started",
        "version": 1,
      },
      {
        "chainIndex": 2,
        "hash": "0d42348c3abb6a8376ab4ed8e609128b4648812348caf62279125902dffdb85e",
        "time": 2500,
        "type": "progress",
        "version": 2,
      },
      {
        "chainIndex": 3,
        "hash": "2097b0685292037f1ec84130500dd3a1d3fa3a2863904799ffdce8fa8056a1f8",
        "time": 3750,
        "type": "progress",
        "version": 3,
      },
      {
        "chainIndex": 4,
        "hash": "e4832c5538db11a6fce54b181e18c9c36a44d756f4f478b242a2fe79174944d2",
        "time": 7500,
        "type": "progress",
        "version": 4,
      },
      {
        "chainIndex": 5,
        "hash": "470fa1c0e352db39632a33061bfa2e439dd6ac2f1f662faf947a49468cb537ba",
        "time": 11250,
        "type": "progress",
        "version": 5,
      },
      {
        "chainIndex": 6,
        "hash": "b8235b9374ecf2933c91f8fe5530a47fa9fe8839282e1022fe320a942ce1c189",
        "time": 15000,
        "type": "progress",
        "version": 6,
      },
      {
        "chainIndex": 7,
        "hash": "2aca4a9a87601995af3170e6df46f7942c7b5a3bc0f8b4d4caffe1bb83c1a813",
        "time": 18750,
        "type": "progress",
        "version": 7,
      },
      {
        "chainIndex": 8,
        "hash": "0d75ce48fd5a0ec2bce3122bc4bbd5323c206888d3ac1d47f8ab62e9d66af819",
        "time": 21250,
        "type": "progress",
        "version": 8,
      },
      {
        "chainIndex": 9,
        "hash": "45d08011b788c7b43a6e2858d4cd4b4ebe1d479825869cfb4046ba8e732bcfcc",
        "time": 25000,
        "type": "progress",
        "version": 9,
      },
      {
        "chainIndex": 10,
        "hash": "c95928929bfb0a416aeb560a7f6f02aff2c30c1342668a702024acb151c0d8ac",
        "time": 27500,
        "type": "progress",
        "version": 10,
      },
      {
        "chainIndex": 11,
        "hash": "7ef1af731cbca24c2ec37a2b1c085553cd5f96b5f3ecf4866087c9ef54779461",
        "time": 30000,
        "type": "progress",
        "version": 11,
      },
      {
        "chainIndex": 12,
        "hash": "25cdf7f8a1df88a12b4c76bdf7e17a77f0db395364bda663d115f1a15e059bc0",
        "time": 33750,
        "type": "progress",
        "version": 12,
      },
      {
        "chainIndex": 13,
        "hash": "e0748114d81b13f777d23505356426e8b5e7b3a02e7c26fe55e3e22f311c2414",
        "time": 35000,
        "type": "progress",
        "version": 13,
      },
      {
        "chainIndex": 14,
        "hash": "2887c3a87720b7bf9ab26a3c1b6cc6982667c1458d6582e0b9e7f31680983ce1",
        "time": 37500,
        "type": "progress",
        "version": 14,
      },
      {
        "chainIndex": 15,
        "hash": "c4581165d418d23f82220590a6368eec8fe1f2ff64ac221da4322fac19822028",
        "time": 40000,
        "type": "progress",
        "version": 15,
      },
      {
        "chainIndex": 16,
        "hash": "6ce6242499785717015e530ca209c8ff3e071b563eeacd43e95aa4f9abc84bc3",
        "time": 42500,
        "type": "progress",
        "version": 16,
      },
      {
        "chainIndex": 17,
        "hash": "55051dcbb66ac44c0e7bba16fef85b8f1bbf10499e2b3a16da1efeb76e8e8d5b",
        "time": 45000,
        "type": "progress",
        "version": 17,
      },
      {
        "chainIndex": 18,
        "hash": "cf79c2ba50a32468b3f6f7af66d9b613abf79be5c1f2225bfb78f72c1370fdd8",
        "time": 47500,
        "type": "progress",
        "version": 18,
      },
      {
        "chainIndex": 19,
        "hash": "209ea7503e10607cbbce55b785595546a3b49ea8ddbf3f71ce3b10ceb42da8e9",
        "time": 50000,
        "type": "progress",
        "version": 19,
      },
      {
        "chainIndex": 20,
        "hash": "399fc5839dd392a4215a078c632988b159a15e396f9adda05d346b495acb2bea",
        "time": 52500,
        "type": "progress",
        "version": 20,
      },
      {
        "chainIndex": 21,
        "hash": "645a3089b11e47cbd1a35565db6a0750b47e7c53add9816ac442100a8bfb1d03",
        "time": 55000,
        "type": "progress",
        "version": 21,
      },
      {
        "chainIndex": 22,
        "hash": "123c2126509544910162ac63de6b97dac3fe7409ec416178692b2b3ca869e761",
        "time": 57500,
        "type": "progress",
        "version": 22,
      },
      {
        "chainIndex": 23,
        "hash": "5d7eace6c117d4d38a9c9d0ac2004da6b723b3e749dd9cd8d9f357f963055f23",
        "time": 60000,
        "type": "progress",
        "version": 23,
      },
      {
        "chainIndex": 24,
        "hash": "e90d3e62164200bfec7f2940cde935cc075a6801b4a7fad71e847fc3807ca8f0",
        "time": 60000,
        "type": "completed",
        "version": 24,
      },
    ]
  `);
});
