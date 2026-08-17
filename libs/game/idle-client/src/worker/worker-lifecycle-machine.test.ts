import { expect, mock, onTestFinished, test } from 'bun:test';
import type { ErrorEvent } from '@sentry/browser';
import {
  createMockActivityData,
  createMockContentDocument,
} from '@vers/contract-activity/test-utils';
import { createSimulation } from '@vers/idle-core';
import { createMockActivityInput, createMockAvatarData } from '@vers/idle-core/test-utils';
import { mockActivityService } from '@vers/mock-services/activity';
import { waitFor } from '@vers/test-utils';
import { writeContentDocumentCache } from '../content/write-content-document-cache';
import { server } from '../mocks/node';
import { writeNodeSeeds } from '../submission/write-node-seeds';
import { writeStartStamps } from '../submission/write-start-stamps';
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
import type { StubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { WorkerMessageType } from '../types';
import { buildDeferred } from './build-deferred';
import { handleStartActivityMessage } from './handle-start-activity-message';
import { handleStopActivityMessage } from './handle-stop-activity-message';
import { runResyncTurn } from './run-resync-turn';
import { sentryHandle } from './sentry-handle';
import { startErrorReporting } from './start-error-reporting';

function collectBroadcasts(context: StubWorkerContext) {
  return {
    received: context.getBroadcasts(),
    waitForMessages: async (count: number) => {
      await waitFor(() => {
        expect(context.getBroadcasts().length).toBeGreaterThanOrEqual(count);
      });
    },
  };
}

test('it sits in idle with no activity', () => {
  const context = createStubWorkerContext();

  expect(context.getLifecycle().getSnapshot().value).toBe('idle');
  expect(context.getActivity()).toBeNull();
});

test('it reports starting while a start flow installs, then running once it lands', async () => {
  const seed = createMockNodeSeed({
    avatarID: 'avatar_declared_state',
    encounterNode: { difficulty: 1 },
    nodeID: '0_0',
  });

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

  await writeContentDocumentCache(
    createMockContentDocument({ contentVersion: seed.contentVersion }),
  );

  let releaseRegister: (() => void) | undefined;

  const registerGate = new Promise<void>((resolve) => {
    releaseRegister = resolve;
  });

  const submitter = createStubSubmitter();

  submitter.registerActivity = mock(() => registerGate);

  const gatedContext = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_declared_state',
    submitter,
  });

  const started = handleStartActivityMessage(gatedContext, {
    avatarID: seed.avatarID,
    scopeID: seed.nodeID,
    scopeType: 'world_map_node',
  });

  // registerActivity is called only once the flow's install has already set the activity and
  // started the simulation — the state has stayed 'starting' the whole time since acceptance
  await waitFor(() => {
    expect(submitter.registerActivity).toHaveBeenCalled();
  });

  expect(gatedContext.getLifecycle().getSnapshot().value).toBe('starting');
  expect(gatedContext.getActivity()).not.toBeNull();
  releaseRegister?.();

  const status = await started;

  expect(status.kind).toBe('started');

  await waitFor(() => {
    expect(gatedContext.getLifecycle().getSnapshot().value).toBe('running');
  });
});

test('it reports resyncing while a resync flow is in flight', async () => {
  let releaseFlush: (() => void) | undefined;

  const heldFlush = new Promise<void>((resolve) => {
    releaseFlush = resolve;
  });

  const context = createStubWorkerContext({
    submitter: {
      flushHeld: () => heldFlush,
      flushNow: () => Promise.resolve(),
      registerActivity: () => Promise.resolve(),
      submit: () => Promise.resolve(undefined),
      isEvicted: () => false,
      removeEviction: () => {},
    },
  });

  const resync = runResyncTurn(context, 'avatar_resyncing_state', false);

  await waitFor(() => {
    expect(context.getLifecycle().getSnapshot().value).toBe('resyncing');
  });

  releaseFlush?.();

  await resync;

  await waitFor(() => {
    expect(context.getLifecycle().getSnapshot().value).toBe('idle');
  });
});

test('it reports continuing while a continuation flow is in flight', async () => {
  server.use(mockActivityService.startActivity.handler(() => new Promise(() => {})));

  const context = createStubWorkerContext();
  const simulation = createSimulation();
  const activity = createMockActivityData();

  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: activity.id }));
  context.setSimulation(simulation);
  context.setActivity(activity);

  const deferred = buildDeferred<void>();

  context.getLifecycle().send({ activity, deferred, simulation, type: 'CONTINUATION' });

  await waitFor(() => {
    expect(context.getLifecycle().getSnapshot().value).toBe('continuing');
  });
});

test("it reports stopping during a stop's durable delivery, then returns to idle", async () => {
  server.use(mockActivityService.stopActivity.handler(() => new Promise(() => {})));

  const context = createStubWorkerContext({ submitter: createStubSubmitter() });
  const activity = createMockActivityData();

  context.setSimulation(createSimulation());
  context.setActivity(activity);

  // not awaited: the durable delivery this drives never settles, by design of the hung handler
  void handleStopActivityMessage(context, { activityID: activity.id, avatarID: activity.avatarID });

  await waitFor(() => {
    expect(context.getLifecycle().getSnapshot().value).toBe('stopping');
  });

  expect(context.getActivity()).toBeNull();
});

test('it returns to idle after a stop with no durable delivery pending', async () => {
  const context = createStubWorkerContext({ submitter: createStubSubmitter() });
  const activity = createMockActivityData();

  context.setSimulation(createSimulation());
  context.setActivity(activity);

  await handleStopActivityMessage(context, {
    activityID: activity.id,
    avatarID: activity.avatarID,
  });

  expect(context.getLifecycle().getSnapshot().value).toBe('idle');
});

test('it queues a start arriving during a resync and runs it after', async () => {
  let releaseFlush: (() => void) | undefined;

  const heldFlush = new Promise<void>((resolve) => {
    releaseFlush = resolve;
  });

  const context = createStubWorkerContext({
    submitter: {
      flushHeld: () => heldFlush,
      flushNow: () => Promise.resolve(),
      registerActivity: () => Promise.resolve(),
      submit: () => Promise.resolve(undefined),
      isEvicted: () => false,
      removeEviction: () => {},
    },
  });

  const seen: Array<unknown> = [];

  const subscription = context.getLifecycle().subscribe((snapshot) => {
    seen.push(snapshot.value);
  });

  onTestFinished(() => {
    subscription.unsubscribe();
  });

  const resync = runResyncTurn(context, 'avatar_queue_order', false);

  await waitFor(() => {
    expect(context.getLifecycle().getSnapshot().value).toBe('resyncing');
  });

  const start = handleStartActivityMessage(context, {
    avatarID: 'avatar_never_cached',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  releaseFlush?.();

  await Promise.all([resync, start]);

  const startIndex = seen.indexOf('starting');
  const resyncIndex = seen.indexOf('resyncing');

  expect(resyncIndex).toBeGreaterThanOrEqual(0);
  expect(startIndex).toBeGreaterThan(resyncIndex);
});

test('it runs queued turns strictly one at a time in queue order', async () => {
  const context = createStubWorkerContext();
  const order: Array<string> = [];
  let releaseFirst: (() => void) | undefined;

  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const first = context.getMailbox().runTurn('start', async () => {
    order.push('first:enter');

    await firstGate;

    order.push('first:exit');
  });

  const second = context.getMailbox().runTurn('start', () => {
    order.push('second:enter');

    return Promise.resolve();
  });

  releaseFirst?.();

  await Promise.all([first, second]);

  expect(order).toStrictEqual(['first:enter', 'first:exit', 'second:enter']);
});

test('it serializes turns queued from different sites on the one actor', async () => {
  const context = createStubWorkerContext();
  const order: Array<string> = [];
  let releaseFirst: (() => void) | undefined;

  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const first = context.getMailbox().runTurn('start', async () => {
    order.push('first:enter');

    await firstGate;

    order.push('first:exit');
  });

  const second = context.getMailbox().runTurn('resync', () => {
    order.push('second:enter');

    return Promise.resolve();
  });

  const third = context.getMailbox().runTurn('continuation', () => {
    order.push('third:enter');

    return Promise.resolve();
  });

  releaseFirst?.();

  await Promise.all([first, second, third]);

  expect(order).toStrictEqual(['first:enter', 'first:exit', 'second:enter', 'third:enter']);
});

test('it keeps the queue alive past a turn that throws', async () => {
  const context = createStubWorkerContext();

  await expect(
    context.getMailbox().runTurn('start', () => Promise.reject(new Error('turn exploded'))),
  ).toResolve();

  let ran = false;

  await context.getMailbox().runTurn('start', () => {
    ran = true;

    return Promise.resolve();
  });

  expect(ran).toBeTrue();
});

test('it resolves the caller only once its own turn settles', async () => {
  const context = createStubWorkerContext();
  let settled = false;

  await context.getMailbox().runTurn('start', async () => {
    await Promise.resolve();

    settled = true;
  });

  expect(settled).toBeTrue();
});

test('it reports an escaping turn error as a fault under its site', async () => {
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

  const context = createStubWorkerContext();

  await context
    .getMailbox()
    .runTurn('continuation', () => Promise.reject(new Error('turn exploded')));

  await waitFor(() => {
    expect(recorded).toHaveLength(1);
  });

  expect(recorded[0]?.tags).toMatchObject({ site: 'continuation' });
});

test('it drops a non-claiming resync while one is queued', async () => {
  const context = createStubWorkerContext();
  const connection = collectBroadcasts(context);
  let releaseBlocking: (() => void) | undefined;

  const blockingGate = new Promise<void>((resolve) => {
    releaseBlocking = resolve;
  });

  const blocking = context.getMailbox().runTurn('start', () => blockingGate);

  // the ticket is set the instant this is accepted, even though its own run is still waiting
  // behind the blocking turn above — so the drop below still applies
  const first = runResyncTurn(context, 'avatar_a', false);

  await expect(runResyncTurn(context, 'avatar_b', false)).toResolve();

  releaseBlocking?.();

  await Promise.all([blocking, first]);
  await connection.waitForMessages(1);

  // only the accepted call's own status ever broadcasts — the dropped call never reached the
  // progress fetch that would have broadcast one under its own avatar
  expect(connection.received).toStrictEqual([
    {
      status: { avatarID: 'avatar_a', kind: 'session-expired' },
      type: WorkerMessageType.ResyncStatus,
    },
  ]);
});

test('it drops a non-claiming resync while one is running', async () => {
  let releaseHeld: (() => void) | undefined;

  const heldFlush = new Promise<void>((resolve) => {
    releaseHeld = resolve;
  });

  const context = createStubWorkerContext({
    submitter: {
      flushHeld: () => heldFlush,
      flushNow: () => Promise.resolve(),
      registerActivity: () => Promise.resolve(),
      submit: () => Promise.resolve(undefined),
      isEvicted: () => false,
      removeEviction: () => {},
    },
  });

  const connection = collectBroadcasts(context);
  const running = runResyncTurn(context, 'avatar_a', false);

  await waitFor(() => {
    expect(context.getLifecycle().getSnapshot().value).toBe('resyncing');
  });

  await expect(runResyncTurn(context, 'avatar_b', false)).toResolve();

  releaseHeld?.();

  await running;

  await connection.waitForMessages(1);

  expect(connection.received).toStrictEqual([
    {
      status: { avatarID: 'avatar_a', kind: 'session-expired' },
      type: WorkerMessageType.ResyncStatus,
    },
  ]);
});

test('it holds a claiming resync and runs it after the in-flight one settles', async () => {
  const gates: Record<string, { readonly promise: Promise<void>; readonly release: () => void }> =
    {};

  for (const avatarID of ['avatar_a', 'avatar_b']) {
    let release: (() => void) | undefined;

    const promise = new Promise<void>((resolve) => {
      release = resolve;
    });

    gates[avatarID] = { promise, release: () => release?.() };
  }

  let currentAvatarID = 'avatar_a';

  const context = createStubWorkerContext({
    submitter: {
      flushHeld: () => gates[currentAvatarID]!.promise,
      flushNow: () => Promise.resolve(),
      registerActivity: () => Promise.resolve(),
      submit: () => Promise.resolve(undefined),
      isEvicted: () => false,
      removeEviction: () => {},
    },
  });

  const connection = collectBroadcasts(context);
  const first = runResyncTurn(context, 'avatar_a', false);

  await waitFor(() => {
    expect(context.getLifecycle().getSnapshot().value).toBe('resyncing');
  });

  currentAvatarID = 'avatar_b';

  const held = runResyncTurn(context, 'avatar_b', true);

  // the claiming call resolves immediately — it never waits on its own eventual run
  await held;

  gates['avatar_a']!.release();
  gates['avatar_b']!.release();

  await first;

  await connection.waitForMessages(2);

  expect(connection.received).toStrictEqual([
    {
      status: { avatarID: 'avatar_a', kind: 'session-expired' },
      type: WorkerMessageType.ResyncStatus,
    },
    {
      status: { avatarID: 'avatar_b', kind: 'session-expired' },
      type: WorkerMessageType.ResyncStatus,
    },
  ]);
});

test('it keeps only the latest claiming avatar when two arrive', async () => {
  let releaseFirst: (() => void) | undefined;

  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const context = createStubWorkerContext({
    submitter: {
      flushHeld: () => firstGate,
      flushNow: () => Promise.resolve(),
      registerActivity: () => Promise.resolve(),
      submit: () => Promise.resolve(undefined),
      isEvicted: () => false,
      removeEviction: () => {},
    },
  });

  const connection = collectBroadcasts(context);
  const first = runResyncTurn(context, 'avatar_a', false);

  await waitFor(() => {
    expect(context.getLifecycle().getSnapshot().value).toBe('resyncing');
  });

  // both claiming calls resolve immediately, without waiting on either eventual run
  await runResyncTurn(context, 'avatar_b', true);
  await runResyncTurn(context, 'avatar_c', true);

  releaseFirst?.();

  await first;

  await connection.waitForMessages(2);

  // avatar_b's held claim was superseded by avatar_c's before either ran — only the first call
  // and the latest claim ever reach a resync status
  expect(connection.received).toStrictEqual([
    {
      status: { avatarID: 'avatar_a', kind: 'session-expired' },
      type: WorkerMessageType.ResyncStatus,
    },
    {
      status: { avatarID: 'avatar_c', kind: 'session-expired' },
      type: WorkerMessageType.ResyncStatus,
    },
  ]);
});

test('it runs a resync arriving during a non-resync turn after that turn rather than dropping it', async () => {
  const context = createStubWorkerContext();
  const order: Array<string> = [];
  let releaseStart: (() => void) | undefined;

  const startGate = new Promise<void>((resolve) => {
    releaseStart = resolve;
  });

  const start = context.getMailbox().runTurn('start', async () => {
    order.push('start:enter');

    await startGate;

    order.push('start:exit');
  });

  // arrives while 'start:enter' still holds the queue — accepted and queued behind it
  // synchronously, before any turn has a chance to run
  const resync = (async () => {
    await runResyncTurn(context, 'avatar_never_cached', false);

    order.push('resync:run');
  })();

  releaseStart?.();

  await Promise.all([start, resync]);

  expect(order).toStrictEqual(['start:enter', 'start:exit', 'resync:run']);
});
