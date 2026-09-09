import { expect, mock, onTestFinished, test } from 'bun:test';
import type { ErrorEvent } from '@sentry/browser';
import {
  createMockActivityData,
  createMockContentDocument,
} from '@vers/contract-activity/test-utils';
import { ActivityFailureAction, buildLevelFromXP, createSimulation } from '@vers/idle-core';
import { createMockActivityInput, createMockAvatarData } from '@vers/idle-core/test-utils';
import { createAuthedServiceClient, createViewer } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { waitFor } from '@vers/test-utils';
import { http } from 'msw';
import invariant from 'tiny-invariant';
import { createActor, fromPromise } from 'xstate';
import { writeContentDocumentCache } from '../content/write-content-document-cache';
import { server } from '../mocks/node';
import { createActivityServiceClient } from '../submission/create-activity-service-client';
import { createCheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { readQueuedCheckpoints } from '../submission/read-queued-checkpoints';
import type { ActivityServiceClient, ActivitySubmissionContext } from '../submission/types';
import { writeActivityStart } from '../submission/write-activity-start';
import { writeLastStartedActivity } from '../submission/write-last-started-activity';
import { writeNodeSeeds } from '../submission/write-node-seeds';
import { writeQueuedCheckpoint } from '../submission/write-queued-checkpoint';
import { writeStartStamps } from '../submission/write-start-stamps';
import { createStubActivityProxy } from '../test-utils/create-stub-activity-proxy';
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
import type { StubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { createMockProgressCheckpoint } from '../test-utils/factories/create-mock-progress-checkpoint';
import { WorkerMessageType } from '../types';
import { buildDeferred } from './build-deferred';
import { handleInitializeMessage } from './handle-initialize-message';
import { handleReportOnlineMessage } from './handle-report-online-message';
import { handleStartActivityMessage } from './handle-start-activity-message';
import { handleStopActivityMessage } from './handle-stop-activity-message';
import { RunOutcomeKind } from './run-outcome-schema';
import { runResyncTurn } from './run-resync-turn';
import { sentryHandle } from './sentry-handle';
import { startErrorReporting } from './start-error-reporting';
import { workerLifecycleMachine } from './worker-lifecycle-machine';

function collectBroadcasts(context: StubWorkerContext) {
  return {
    get received() {
      return context.getBroadcasts();
    },
    waitForMessages: async (count: number) => {
      await waitFor(() => {
        expect(context.getBroadcasts().length).toBeGreaterThanOrEqual(count);
      });
    },
  };
}

async function waitForActiveResync(context: StubWorkerContext, avatarID: string): Promise<void> {
  await waitFor(() => {
    expect(context.getLifecycle().getSnapshot().context.currentRequest).toMatchObject({
      avatarID,
      kind: 'resync',
    });
  });
}

async function setupStartableNode(avatarID: string): Promise<void> {
  const seed = createMockNodeSeed({ avatarID, encounterNode: { difficulty: 1 }, nodeID: '0_0' });

  await writeNodeSeeds(avatarID, [seed]);
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

  await writeContentDocumentCache(
    createMockContentDocument({ contentVersion: seed.contentVersion }),
  );
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
      collectActivityStates: () => [],
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
  const seed = createMockNodeSeed({
    avatarID: 'avatar_continuing',
    encounterNode: { difficulty: 1 },
    nodeID: '0_0',
  });

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

  // the content load past the local mint never settles, holding the flow in its continuing phase
  server.use(mockActivityService.getContentDocument.handler(() => new Promise(() => {})));

  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_1' });
  const simulation = createSimulation();
  const activity = createMockActivityData({ avatarID: seed.avatarID, scopeID: seed.nodeID });

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
      collectActivityStates: () => [],
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

test("it resyncs the avatar ahead of a start that arrives before the boot resync, so the mint folds the server's snapshot and predecessor", async () => {
  const viewer = await createViewer({ avatar: { xp: 400 } });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_boot',
    client,
    submitter: createStubSubmitter(),
  });

  await setupStartableNode(viewer.avatar.id);

  // the previous run failed and was fully delivered: its terminal total is still owed on top of
  // the settled xp, and a reloaded worker holds no record of it
  const delivered = await db.activityCollection.create({
    appendedHead: 1,
    avatarID: viewer.avatar.id,
    buildSnapshot: { level: buildLevelFromXP(400), xp: 400 },
    status: 'stopped',
    verifiedHead: 0,
  });

  await db.checkpointCollection.create({
    activityID: delivered.id,
    payload: {
      chainIndex: 1,
      entropySource: 'server-key',
      nextSeed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
      rewards: { xp: 9 },
      seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
      time: 1000,
      type: 'failed',
    },
    version: 1,
  });

  const seen: Array<unknown> = [];

  const subscription = context.getLifecycle().subscribe((snapshot) => {
    seen.push(snapshot.value);
  });

  onTestFinished(() => {
    subscription.unsubscribe();
  });

  const status = await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  invariant(status.kind === 'started', 'expected the start to mint once the resync settled');

  expect(status.activity.buildSnapshot).toStrictEqual({ level: buildLevelFromXP(409), xp: 409 });
  expect(status.activity.predecessorActivityID).toBe(delivered.id);
  expect(seen.indexOf('resyncing')).toBeGreaterThanOrEqual(0);
  expect(seen.indexOf('starting')).toBeGreaterThan(seen.indexOf('resyncing'));
});

test("it starts at once when the avatar's latest run is already recorded", async () => {
  const context = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_test',
    submitter: createStubSubmitter(),
  });

  await setupStartableNode('avatar_known_record');

  context.setLatestRun({
    activityID: 'act_known',
    avatarID: 'avatar_known_record',
    baselineXP: 0,
    deltaXP: 0,
    tail: null,
  });

  const seen: Array<unknown> = [];

  const subscription = context.getLifecycle().subscribe((snapshot) => {
    seen.push(snapshot.value);
  });

  onTestFinished(() => {
    subscription.unsubscribe();
  });

  const status = await handleStartActivityMessage(context, {
    avatarID: 'avatar_known_record',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(status.kind).toBe('started');
  expect(seen).not.toContain('resyncing');
});

test("it starts without another resync when the resync it queued behind recorded its avatar's latest run", async () => {
  const viewer = await createViewer({ avatar: { xp: 400 } });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  let releaseFlush: (() => void) | undefined;

  const heldFlush = new Promise<void>((resolve) => {
    releaseFlush = resolve;
  });

  const context = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_test',
    client,
    submitter: {
      flushHeld: () => heldFlush,
      flushNow: () => Promise.resolve(),
      registerActivity: () => Promise.resolve(),
      submit: () => Promise.resolve(undefined),
      collectActivityStates: () => [],
      isEvicted: () => false,
      removeEviction: () => {},
    },
  });

  await setupStartableNode(viewer.avatar.id);

  await db.activityCollection.create({
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    buildSnapshot: { level: buildLevelFromXP(400), xp: 400 },
    status: 'stopped',
    verifiedHead: 0,
  });

  const seen: Array<Readonly<{ kind: string }> | null> = [];

  const subscription = context.getLifecycle().subscribe((snapshot) => {
    seen.push(snapshot.context.currentRequest);
  });

  onTestFinished(() => {
    subscription.unsubscribe();
  });

  const resync = runResyncTurn(context, viewer.avatar.id, false);

  await waitFor(() => {
    expect(context.getLifecycle().getSnapshot().value).toBe('resyncing');
  });

  const start = handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  releaseFlush?.();

  const [, status] = await Promise.all([resync, start]);

  expect(status.kind).toBe('started');

  // every snapshot repeats the request in flight, so distinct request objects count the resyncs
  const resyncRequests = new Set(seen.filter((request) => request?.kind === 'resync'));

  expect(resyncRequests.size).toBe(1);
});

test("it resyncs the start's avatar once an earlier resync for another avatar has cleared its live run", async () => {
  const gates: Record<string, { readonly promise: Promise<void>; readonly release: () => void }> =
    {};

  for (const avatarID of ['avatar_a', 'avatar_b']) {
    let release: (() => void) | undefined;

    const promise = new Promise<void>((resolve) => {
      release = resolve;
    });

    gates[avatarID] = { promise, release: () => release?.() };
  }

  let currentAvatarID = 'avatar_b';

  const context = createStubWorkerContext({
    submitter: {
      flushHeld: () => gates[currentAvatarID]!.promise,
      flushNow: () => Promise.resolve(),
      registerActivity: () => Promise.resolve(),
      submit: () => Promise.resolve(undefined),
      collectActivityStates: () => [],
      isEvicted: () => false,
      removeEviction: () => {},
    },
  });

  // a live run for avatar_a is installed, which would let a start for it skip the resync — but
  // the resync for avatar_b ahead of it resets that run before the start reaches the head
  context.setSimulation(createSimulation());
  context.setActivity(createMockActivityData({ avatarID: 'avatar_a' }));

  const resync = runResyncTurn(context, 'avatar_b', false);

  await waitFor(() => {
    expect(context.getLifecycle().getSnapshot().value).toBe('resyncing');
  });

  const start = handleStartActivityMessage(context, {
    avatarID: 'avatar_a',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  currentAvatarID = 'avatar_a';

  gates['avatar_b']!.release();

  await waitForActiveResync(context, 'avatar_a');

  expect(context.getActivity()).toBeNull();

  gates['avatar_a']!.release();

  await Promise.all([resync, start]);
});

test('it builds the prerequisite resync at the head of the queue, so a stop scope advanced while the start waited does not abort it', async () => {
  const gates: Record<string, { readonly promise: Promise<void>; readonly release: () => void }> =
    {};

  for (const avatarID of ['avatar_a', 'avatar_b']) {
    let release: (() => void) | undefined;

    const promise = new Promise<void>((resolve) => {
      release = resolve;
    });

    gates[avatarID] = { promise, release: () => release?.() };
  }

  let currentAvatarID = 'avatar_b';

  const context = createStubWorkerContext({
    submitter: {
      flushHeld: () => gates[currentAvatarID]!.promise,
      flushNow: () => Promise.resolve(),
      registerActivity: () => Promise.resolve(),
      submit: () => Promise.resolve(undefined),
      collectActivityStates: () => [],
      isEvicted: () => false,
      removeEviction: () => {},
    },
  });

  const resync = runResyncTurn(context, 'avatar_b', false);

  await waitFor(() => {
    expect(context.getLifecycle().getSnapshot().value).toBe('resyncing');
  });

  const start = handleStartActivityMessage(context, {
    avatarID: 'avatar_a',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  context.advanceStopScope();

  currentAvatarID = 'avatar_a';

  gates['avatar_b']!.release();

  await waitForActiveResync(context, 'avatar_a');

  const prerequisite = context.getLifecycle().getSnapshot().context.currentRequest;

  invariant(
    prerequisite !== null && prerequisite.kind === 'resync',
    'expected the prerequisite resync as the active request',
  );

  expect(prerequisite.signals.stop.aborted).toBeFalse();

  gates['avatar_a']!.release();

  await Promise.all([resync, start]);
});

test('it runs queued starts strictly one at a time in queue order', async () => {
  const order: Array<string> = [];
  let releaseFirst: (() => void) | undefined;

  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const submitter = createStubSubmitter();

  submitter.registerActivity = mock((input: Readonly<ActivitySubmissionContext>) => {
    order.push(input.avatarID ?? 'unknown');

    return input.avatarID === 'avatar_queue_order_first' ? firstGate : Promise.resolve();
  });

  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_test', submitter });

  await setupStartableNode('avatar_queue_order_first');
  await setupStartableNode('avatar_queue_order_second');

  const first = handleStartActivityMessage(context, {
    avatarID: 'avatar_queue_order_first',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  await waitFor(() => {
    expect(submitter.registerActivity).toHaveBeenCalledTimes(1);
  });

  const second = handleStartActivityMessage(context, {
    avatarID: 'avatar_queue_order_second',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  // the second start is accepted onto the queue while the first is still installing — its own
  // registration doesn't run until the first's own flow settles
  expect(context.getLifecycle().getSnapshot().value).toBe('starting');
  expect(order).toStrictEqual(['avatar_queue_order_first']);
  releaseFirst?.();

  await Promise.all([first, second]);

  expect(order).toStrictEqual(['avatar_queue_order_first', 'avatar_queue_order_second']);
});

test('it serializes flows queued from different kinds on the one actor', async () => {
  let releaseFirst: (() => void) | undefined;

  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const submitter = createStubSubmitter();

  submitter.registerActivity = mock(() => firstGate);

  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_test', submitter });

  await setupStartableNode('avatar_mixed_kinds');

  // the avatar's latest run is already known, so the start needs no resync ahead of it
  context.setLatestRun({
    activityID: 'act_known',
    avatarID: 'avatar_mixed_kinds',
    baselineXP: 0,
    deltaXP: 0,
    tail: null,
  });

  const seen: Array<unknown> = [];

  const subscription = context.getLifecycle().subscribe((snapshot) => {
    seen.push(snapshot.value);
  });

  onTestFinished(() => {
    subscription.unsubscribe();
  });

  const start = handleStartActivityMessage(context, {
    avatarID: 'avatar_mixed_kinds',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  await waitFor(() => {
    expect(context.getLifecycle().getSnapshot().value).toBe('starting');
  });

  const resync = runResyncTurn(context, 'avatar_mixed_kinds_resync', false);

  // a fresh simulation/activity pair the machine's own state never installs — its continuation
  // is a real queued flow whose own body no-ops on the mismatch, exactly proving the machine
  // still occupies the 'continuing' state for it in turn
  const deferred = buildDeferred<void>();

  context.getLifecycle().send({
    activity: createMockActivityData(),
    deferred,
    simulation: createSimulation(),
    type: 'CONTINUATION',
  });

  releaseFirst?.();

  await Promise.all([start, resync, deferred.promise]);

  const startIndex = seen.indexOf('starting');
  const resyncIndex = seen.indexOf('resyncing');
  const continuingIndex = seen.indexOf('continuing');

  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(resyncIndex).toBeGreaterThan(startIndex);
  expect(continuingIndex).toBeGreaterThan(resyncIndex);
});

test('it keeps the queue alive past a start that throws', async () => {
  const submitter = createStubSubmitter();

  submitter.registerActivity = mock(() => Promise.reject(new Error('turn exploded')));

  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_test', submitter });

  await setupStartableNode('avatar_throws');

  const input = {
    avatarID: 'avatar_throws',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  } as const;

  const first = await handleStartActivityMessage(context, input);

  expect(first.kind).toBe('failed');

  submitter.registerActivity = mock(() => Promise.resolve());

  // the same avatar and scope the first call already installed — the fast "already attached"
  // path, proving the queue accepted and ran this call rather than staying stuck behind the throw
  const second = await handleStartActivityMessage(context, input);

  expect(second.kind).toBe('attached');
});

test('it resolves the caller only once its own flow settles', async () => {
  let registrationSettled = false;
  const submitter = createStubSubmitter();

  submitter.registerActivity = mock(async () => {
    await Promise.resolve();

    registrationSettled = true;
  });

  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_test', submitter });

  await setupStartableNode('avatar_settle_order');

  await handleStartActivityMessage(context, {
    avatarID: 'avatar_settle_order',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(registrationSettled).toBeTrue();
});

test('it reports an escaping flow error as a fault under its site', async () => {
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

  const submitter = createStubSubmitter();

  submitter.registerActivity = mock(() => Promise.reject(new Error('turn exploded')));

  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_test', submitter });

  await setupStartableNode('avatar_reports_fault');

  await handleStartActivityMessage(context, {
    avatarID: 'avatar_reports_fault',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  await waitFor(() => {
    expect(recorded).toHaveLength(1);
  });

  expect(recorded[0]?.tags).toMatchObject({ site: 'start' });
});

test('it drops a non-claiming resync while one is queued', async () => {
  const submitter = createStubSubmitter();
  let releaseBlocking: (() => void) | undefined;

  const blockingGate = new Promise<void>((resolve) => {
    releaseBlocking = resolve;
  });

  submitter.registerActivity = mock(() => blockingGate);

  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_test', submitter });
  const connection = collectBroadcasts(context);

  await setupStartableNode('avatar_blocking_start');

  // the avatar's latest run is already known, so the start needs no resync ahead of it
  context.setLatestRun({
    activityID: 'act_known',
    avatarID: 'avatar_blocking_start',
    baselineXP: 0,
    deltaXP: 0,
    tail: null,
  });

  const blocking = handleStartActivityMessage(context, {
    avatarID: 'avatar_blocking_start',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  await waitFor(() => {
    expect(context.getLifecycle().getSnapshot().value).toBe('starting');
  });

  // the ticket is set the instant this is accepted, even though its own run is still waiting
  // behind the blocking start above — so the drop below still applies
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
      collectActivityStates: () => [],
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
      collectActivityStates: () => [],
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
      collectActivityStates: () => [],
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

test('it settles the first caller only after the held follow-up runs', async () => {
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
      collectActivityStates: () => [],
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

  await runResyncTurn(context, 'avatar_b', true);

  // both runs broadcast their status before their flow settles, so the count observed the moment
  // the first caller resolves proves the held follow-up had already run by then
  const receivedCountAtFirstSettle = (async () => {
    await first;

    return connection.received.length;
  })();

  gates['avatar_a']!.release();
  gates['avatar_b']!.release();

  const observedCount = await receivedCountAtFirstSettle;

  expect(observedCount).toBe(2);
});

test('it captures a requeued claim signals at requeue rather than at its arrival', async () => {
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
      collectActivityStates: () => [],
      isEvicted: () => false,
      removeEviction: () => {},
    },
  });

  const first = runResyncTurn(context, 'avatar_a', false);

  await waitFor(() => {
    expect(context.getLifecycle().getSnapshot().value).toBe('resyncing');
  });

  const firstRequest = context.getLifecycle().getSnapshot().context.currentRequest;

  invariant(
    firstRequest !== null && firstRequest.kind === 'resync',
    'expected the in-flight resync as the active request',
  );

  currentAvatarID = 'avatar_b';

  await runResyncTurn(context, 'avatar_b', true);

  // a stop scope advanced while the claim is held aborts the first run's captured signals; the
  // requeued run must capture the fresh scope at requeue rather than inherit these
  context.advanceStopScope();

  expect(firstRequest.signals.stop.aborted).toBeTrue();

  gates['avatar_a']!.release();

  await waitForActiveResync(context, 'avatar_b');

  const requeuedRequest = context.getLifecycle().getSnapshot().context.currentRequest;

  invariant(
    requeuedRequest !== null && requeuedRequest.kind === 'resync',
    'expected the requeued claim as the active request',
  );

  expect(requeuedRequest.signals.stop.aborted).toBeFalse();

  gates['avatar_b']!.release();

  await first;
});

test('it accepts a later resync after a resync flow faults', async () => {
  let flushCalls = 0;

  const context = createStubWorkerContext({
    submitter: {
      // handler scripting: the first resync's flush fails so its flow settles through the fault
      // path, and the follow-up's succeeds
      flushHeld: () => {
        flushCalls += 1;

        return flushCalls === 1 ? Promise.reject(new Error('flush exploded')) : Promise.resolve();
      },
      flushNow: () => Promise.resolve(),
      registerActivity: () => Promise.resolve(),
      submit: () => Promise.resolve(undefined),
      collectActivityStates: () => [],
      isEvicted: () => false,
      removeEviction: () => {},
    },
  });

  const connection = collectBroadcasts(context);

  await runResyncTurn(context, 'avatar_a', false);
  await runResyncTurn(context, 'avatar_b', false);

  await connection.waitForMessages(2);

  expect(connection.received).toStrictEqual([
    {
      status: { avatarID: 'avatar_a', kind: 'failed' },
      type: WorkerMessageType.ResyncStatus,
    },
    {
      status: { avatarID: 'avatar_b', kind: 'session-expired' },
      type: WorkerMessageType.ResyncStatus,
    },
  ]);
});

test('it recovers the queue when a resync service itself rejects', async () => {
  const runtime = createStubWorkerContext();
  let serviceCalls = 0;

  const machine = workerLifecycleMachine.provide({
    actors: {
      runResyncActor: fromPromise((): Promise<void> => {
        serviceCalls += 1;

        return Promise.reject(new Error('service exploded'));
      }),
    },
  });

  const actor = createActor(machine, {
    input: {
      failureActionSeeded: Promise.resolve(),
      runtime,
      shutdownSignal: new AbortController().signal,
    },
  }).start();

  onTestFinished(() => {
    actor.stop();
  });

  const first = buildDeferred<void>();

  actor.send({ avatarID: 'avatar_a', claim: false, deferred: first, type: 'RESYNC' });

  await first.promise;

  const second = buildDeferred<void>();

  actor.send({ avatarID: 'avatar_a', claim: false, deferred: second, type: 'RESYNC' });

  await second.promise;

  // a dropped call would resolve without invoking the service — two invocations prove the second
  // call was accepted after the first escaped
  expect(serviceCalls).toBe(2);
  expect(actor.getSnapshot().value).toBe('idle');
});

test('it runs a resync arriving during a non-resync turn after that turn rather than dropping it', async () => {
  const submitter = createStubSubmitter();
  let releaseBlocking: (() => void) | undefined;

  const blockingGate = new Promise<void>((resolve) => {
    releaseBlocking = resolve;
  });

  submitter.registerActivity = mock(() => blockingGate);

  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_test', submitter });

  await setupStartableNode('avatar_blocks_resync');

  // the avatar's latest run is already known, so the start needs no resync ahead of it
  context.setLatestRun({
    activityID: 'act_known',
    avatarID: 'avatar_blocks_resync',
    baselineXP: 0,
    deltaXP: 0,
    tail: null,
  });

  const seen: Array<unknown> = [];

  const subscription = context.getLifecycle().subscribe((snapshot) => {
    seen.push(snapshot.value);
  });

  onTestFinished(() => {
    subscription.unsubscribe();
  });

  // arrives while the start is still installing — accepted and queued behind it synchronously,
  // before any flow has a chance to run
  const blocking = handleStartActivityMessage(context, {
    avatarID: 'avatar_blocks_resync',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  await waitFor(() => {
    expect(context.getLifecycle().getSnapshot().value).toBe('starting');
  });

  const resync = runResyncTurn(context, 'avatar_never_cached', false);

  releaseBlocking?.();

  await Promise.all([blocking, resync]);

  const startingIndex = seen.indexOf('starting');
  const resyncingIndex = seen.indexOf('resyncing');

  expect(startingIndex).toBeGreaterThanOrEqual(0);
  expect(resyncingIndex).toBeGreaterThan(startingIndex);
});

test('it runs a start queued during an in-flight resync before a held claim requeues', async () => {
  let releaseFlush: (() => void) | undefined;

  const heldFlush = new Promise<void>((resolve) => {
    releaseFlush = resolve;
  });

  const context = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_test',
    submitter: {
      flushHeld: () => heldFlush,
      flushNow: () => Promise.resolve(),
      registerActivity: () => Promise.resolve(),
      submit: () => Promise.resolve(undefined),
      collectActivityStates: () => [],
      isEvicted: () => false,
      removeEviction: () => {},
    },
  });

  await setupStartableNode('avatar_held_claim_order');

  const seen: Array<unknown> = [];

  const subscription = context.getLifecycle().subscribe((snapshot) => {
    seen.push(snapshot.value);
  });

  onTestFinished(() => {
    subscription.unsubscribe();
  });

  const resync = runResyncTurn(context, 'avatar_order_a', false);

  await waitFor(() => {
    expect(context.getLifecycle().getSnapshot().value).toBe('resyncing');
  });

  // queued behind the in-flight resync above — its own run must land before the held claim
  // below requeues, preserving the arrival order between the two
  const start = handleStartActivityMessage(context, {
    avatarID: 'avatar_held_claim_order',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  // a claiming resync arrives while the first is still in flight — held one deep rather than
  // queued, its own caller resolving immediately without waiting on its eventual run
  await runResyncTurn(context, 'avatar_order_claim', true);

  releaseFlush?.();

  await start;
  await resync;

  await waitFor(() => {
    expect(context.getLifecycle().getSnapshot().value).toBe('idle');
  });

  const firstResyncIndex = seen.indexOf('resyncing');
  const startIndex = seen.indexOf('starting');
  const heldClaimIndex = seen.lastIndexOf('resyncing');

  expect(startIndex).toBeGreaterThan(firstResyncIndex);
  expect(heldClaimIndex).toBeGreaterThan(startIndex);
});

test('it drops a non-claiming resync arriving while a requeued claim is running', async () => {
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
      collectActivityStates: () => [],
      isEvicted: () => false,
      removeEviction: () => {},
    },
  });

  const connection = collectBroadcasts(context);
  const first = runResyncTurn(context, 'avatar_a', false);

  await waitFor(() => {
    expect(context.getLifecycle().getSnapshot().value).toBe('resyncing');
  });

  // held one deep while avatar_a's run is in flight
  await runResyncTurn(context, 'avatar_b', true);

  currentAvatarID = 'avatar_b';

  gates['avatar_a']!.release();

  // avatar_a settles and the held claim's requeued run is now the active flow — still inside
  // the coalescing window this requeue reopens
  await waitForActiveResync(context, 'avatar_b');

  await expect(runResyncTurn(context, 'avatar_c', false)).toResolve();

  gates['avatar_b']!.release();

  await first;

  await connection.waitForMessages(2);

  // avatar_c never reaches a resync status — dropped rather than queued behind avatar_b's
  // requeued run
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

test('it holds a claiming resync arriving while a requeued claim is running', async () => {
  const gates: Record<string, { readonly promise: Promise<void>; readonly release: () => void }> =
    {};

  for (const avatarID of ['avatar_a', 'avatar_b', 'avatar_d']) {
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
      collectActivityStates: () => [],
      isEvicted: () => false,
      removeEviction: () => {},
    },
  });

  const connection = collectBroadcasts(context);
  const first = runResyncTurn(context, 'avatar_a', false);

  await waitFor(() => {
    expect(context.getLifecycle().getSnapshot().value).toBe('resyncing');
  });

  // held one deep while avatar_a's run is in flight
  await runResyncTurn(context, 'avatar_b', true);

  currentAvatarID = 'avatar_b';

  gates['avatar_a']!.release();

  // avatar_a settles and the held claim's requeued run is now the active flow — still inside
  // the coalescing window this requeue reopens
  await waitForActiveResync(context, 'avatar_b');

  // a second claiming resync arrives in that same window — held one deep rather than queued as
  // its own request, its own caller resolving immediately without waiting on its eventual run
  await runResyncTurn(context, 'avatar_d', true);

  currentAvatarID = 'avatar_d';

  gates['avatar_b']!.release();
  gates['avatar_d']!.release();

  await first;

  await connection.waitForMessages(3);

  expect(connection.received).toStrictEqual([
    {
      status: { avatarID: 'avatar_a', kind: 'session-expired' },
      type: WorkerMessageType.ResyncStatus,
    },
    {
      status: { avatarID: 'avatar_b', kind: 'session-expired' },
      type: WorkerMessageType.ResyncStatus,
    },
    {
      status: { avatarID: 'avatar_d', kind: 'session-expired' },
      type: WorkerMessageType.ResyncStatus,
    },
  ]);
});

test("it mints on a fresh device from the server's latest run and its unsettled xp", async () => {
  const viewer = await createViewer({ avatar: { xp: 400 } });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_matrix',
    client,
    submitter: createStubSubmitter(),
  });

  await setupStartableNode(viewer.avatar.id);

  // a run another device played to a failure and delivered: its terminal total is still owed on
  // top of the settled xp, and this device holds no record of it
  const delivered = await db.activityCollection.create({
    appendedHead: 1,
    avatarID: viewer.avatar.id,
    buildSnapshot: { level: buildLevelFromXP(400), xp: 400 },
    status: 'stopped',
    verifiedHead: 0,
  });

  await db.checkpointCollection.create({
    activityID: delivered.id,
    payload: {
      chainIndex: 1,
      entropySource: 'server-key',
      nextSeed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
      rewards: { xp: 9 },
      seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
      time: 1000,
      type: 'failed',
    },
    version: 1,
  });

  await handleReportOnlineMessage(context, { avatarID: viewer.avatar.id, claim: true });

  const status = await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  invariant(status.kind === 'started', 'expected the fresh device to mint');

  expect(status.activity.buildSnapshot).toStrictEqual({ level: buildLevelFromXP(409), xp: 409 });
  expect(status.activity.predecessorActivityID).toBe(delivered.id);
  expect(context.getBroadcasts()).toStrictEqual([]);
});

test('it resyncs before a start that beats the boot report on a reload with a delivered run', async () => {
  const viewer = await createViewer({ avatar: { xp: 400 } });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_matrix',
    client,
    submitter: createStubSubmitter(),
  });

  await setupStartableNode(viewer.avatar.id);

  const delivered = await db.activityCollection.create({
    appendedHead: 1,
    avatarID: viewer.avatar.id,
    buildSnapshot: { level: buildLevelFromXP(400), xp: 400 },
    status: 'stopped',
    verifiedHead: 0,
  });

  await db.checkpointCollection.create({
    activityID: delivered.id,
    payload: {
      chainIndex: 1,
      entropySource: 'server-key',
      nextSeed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
      rewards: { xp: 9 },
      seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
      time: 1000,
      type: 'failed',
    },
    version: 1,
  });

  // the reload keeps the durable record of the delivered run and loses the in-memory one
  await writeLastStartedActivity({ avatarID: viewer.avatar.id, lastActivityID: delivered.id });

  const seen: Array<unknown> = [];

  const subscription = context.getLifecycle().subscribe((snapshot) => {
    seen.push(snapshot.value);
  });

  onTestFinished(() => {
    subscription.unsubscribe();
  });

  // the tab's start reaches the worker before the mount's boot report does
  const started = handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const reported = runResyncTurn(context, viewer.avatar.id, true);

  const [status] = await Promise.all([started, reported]);

  invariant(status.kind === 'started', 'expected the start to mint once the resync settled');

  expect(status.activity.buildSnapshot).toStrictEqual({ level: buildLevelFromXP(409), xp: 409 });
  expect(status.activity.predecessorActivityID).toBe(delivered.id);
  expect(seen.indexOf('resyncing')).toBeGreaterThanOrEqual(0);
  expect(seen.indexOf('starting')).toBeGreaterThan(seen.indexOf('resyncing'));
  expect(context.getBroadcasts()).toStrictEqual([]);

  await waitFor(() => {
    expect(context.getLifecycle().getSnapshot().value).toBe('running');
  });
});

test('it delivers the start on a reload with an undelivered start and reattaches its run', async () => {
  const viewer = await createViewer({ avatar: { xp: 400 } });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_matrix',
    client,
    submitter: createStubSubmitter(),
  });

  await setupStartableNode(viewer.avatar.id);

  const next = createMockNodeSeed({
    avatarID: viewer.avatar.id,
    encounterNode: { difficulty: 1 },
    nodeID: '1_0',
  });

  await writeNodeSeeds(viewer.avatar.id, [next]);

  await writeContentDocumentCache(
    createMockContentDocument({ contentVersion: next.contentVersion }),
  );

  const delivered = await db.activityCollection.create({
    appendedHead: 1,
    avatarID: viewer.avatar.id,
    buildSnapshot: { level: buildLevelFromXP(400), xp: 400 },
    status: 'stopped',
    verifiedHead: 0,
  });

  await db.checkpointCollection.create({
    activityID: delivered.id,
    payload: {
      chainIndex: 1,
      entropySource: 'server-key',
      nextSeed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
      rewards: { xp: 9 },
      seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
      time: 1000,
      type: 'failed',
    },
    version: 1,
  });

  // a start this device minted on the delivered run and never delivered before the reload
  const undelivered = createMockActivityData({
    avatarID: viewer.avatar.id,
    buildSnapshot: { level: buildLevelFromXP(409), xp: 409 },
    id: 'act_matrix_undelivered',
    predecessorActivityID: delivered.id,
    scopeID: '0_0',
    seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
    startKey: 'start_key_matrix_undelivered',
  });

  await writeActivityStart(undelivered);
  await writeLastStartedActivity({ avatarID: viewer.avatar.id, lastActivityID: undelivered.id });
  await handleReportOnlineMessage(context, { avatarID: viewer.avatar.id, claim: true });

  const reattachedID = context.getActivity()?.id;

  const status = await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '1_0',
    scopeType: 'world_map_node',
  });

  invariant(status.kind === 'started', 'expected the next start to mint behind the delivered one');

  const remaining = await readAllActivityStarts();

  expect(reattachedID).toBe(undelivered.id);
  expect(status.activity.buildSnapshot).toStrictEqual({ level: buildLevelFromXP(409), xp: 409 });
  expect(status.activity.predecessorActivityID).toBe(undelivered.id);
  expect(remaining.map((row) => row.id)).toStrictEqual([status.activity.id]);

  expect(context.getBroadcasts()).toStrictEqual([
    { activityID: undelivered.id, type: WorkerMessageType.ActivityStartIngested },
  ]);
});

test("it attaches a second tab's start to the writer's live run without a mint", async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_matrix',
    client,
    submitter: createStubSubmitter(),
  });

  await setupStartableNode(viewer.avatar.id);

  // the writer's live run: the server's active row this worker attached on its own boot
  const live = await db.activityCollection.create({
    appendedHead: 1,
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
    startedAt: new Date(),
  });

  await handleReportOnlineMessage(context, { avatarID: viewer.avatar.id, claim: true });

  const initialized = handleInitializeMessage(context);

  const status = await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(initialized.liveRun).toStrictEqual({
    avatarID: viewer.avatar.id,
    id: live.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(status).toStrictEqual({ activityID: live.id, kind: 'attached' });
  expect(readAllActivityStarts()).resolves.toStrictEqual([]);
  expect(context.getBroadcasts()).toStrictEqual([]);
});

test('it clears the run and mints behind it when the worker is evicted while a run is live', async () => {
  const viewer = await createViewer({ avatar: { xp: 400 } });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  // the real submitter, so the eviction is the server refusing an append; the lifecycle it reports
  // to is filled in once the context exists, because each references the other
  const lifecycle: { current: StubWorkerContext['getLifecycle'] | undefined } = {
    current: undefined,
  };

  const submitter = createCheckpointSubmitter({
    client,
    onEvicted: (activityID) => {
      lifecycle.current?.().send({ activityID, type: 'SUBMITTER_EVICTED' });
    },
    onInvalid: () => {},
    scheduleFlush: () => {},
  });

  const context = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_matrix',
    client,
    submitter,
  });

  lifecycle.current = context.getLifecycle;

  await setupStartableNode(viewer.avatar.id);

  const live = await db.activityCollection.create({
    appendedHead: 1,
    avatarID: viewer.avatar.id,
    buildSnapshot: { level: buildLevelFromXP(400), xp: 400 },
    scopeID: '0_0',
    seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
    startedAt: new Date(),
  });

  await handleReportOnlineMessage(context, { avatarID: viewer.avatar.id, claim: true });

  // another session took the writer: every append from this one is refused from here on
  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      throw opts.errors.SESSION_EVICTED({ data: {} });
    }),
  );

  await submitter.submit(
    live.id,
    createMockProgressCheckpoint({ nextSeed: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbb6072' }),
  );

  await submitter.flushNow(live.id);

  await waitFor(() => {
    expect(context.getBroadcasts()).toContainEqual({
      activityID: live.id,
      type: WorkerMessageType.WriterDisplaced,
    });
  });

  const status = await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  invariant(status.kind === 'started', 'expected the start after the eviction to mint');

  expect(status.activity.buildSnapshot).toStrictEqual({ level: buildLevelFromXP(400), xp: 400 });
  expect(status.activity.predecessorActivityID).toBe(live.id);

  expect(context.getBroadcasts()).toStrictEqual([
    { activityID: live.id, type: WorkerMessageType.WriterDisplaced },
  ]);
});

test('it discards the outbox on a takeover from another device and mints from the server after the next sign-in', async () => {
  const viewer = await createViewer({ avatar: { xp: 400 } });

  // the worker's own service client, so the proxy's superseded-session marker reaches its discard
  server.use(createStubActivityProxy(viewer.user.id));

  const context = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_matrix',
    client: createActivityServiceClient(),
    submitter: createStubSubmitter(),
  });

  await setupStartableNode(viewer.avatar.id);

  const delivered = await db.activityCollection.create({
    appendedHead: 1,
    avatarID: viewer.avatar.id,
    buildSnapshot: { level: buildLevelFromXP(400), xp: 400 },
    status: 'stopped',
    verifiedHead: 0,
  });

  await db.checkpointCollection.create({
    activityID: delivered.id,
    payload: {
      chainIndex: 1,
      entropySource: 'server-key',
      nextSeed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
      rewards: { xp: 9 },
      seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
      time: 1000,
      type: 'failed',
    },
    version: 1,
  });

  await handleReportOnlineMessage(context, { avatarID: viewer.avatar.id, claim: true });

  // a start minted offline on the delivered run and never delivered
  const undelivered = createMockActivityData({
    avatarID: viewer.avatar.id,
    id: 'act_matrix_taken_over',
    predecessorActivityID: delivered.id,
    startKey: 'start_key_matrix_taken_over',
  });

  await writeActivityStart(undelivered);
  await writeLastStartedActivity({ avatarID: viewer.avatar.id, lastActivityID: undelivered.id });

  // another device took the account over: app-web refuses every call with the superseded marker
  server.use(
    http.all(
      `${self.location.origin}/api/rpc/activity/*`,
      () => new Response(null, { headers: { 'x-session-superseded': '1' }, status: 401 }),
    ),
  );

  await handleReportOnlineMessage(context, { avatarID: viewer.avatar.id, claim: false });

  const outboxAfterTakeover = await readAllActivityStarts();

  // the player signs back in here: the session answers again, and the map reveal restocks the
  // node inputs the discard cleared
  server.resetHandlers();
  server.use(createStubActivityProxy(viewer.user.id));

  await setupStartableNode(viewer.avatar.id);
  await handleReportOnlineMessage(context, { avatarID: viewer.avatar.id, claim: true });

  const status = await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  invariant(status.kind === 'started', 'expected the start after the sign-in to mint');

  expect(outboxAfterTakeover).toStrictEqual([]);
  expect(status.activity.buildSnapshot).toStrictEqual({ level: buildLevelFromXP(409), xp: 409 });
  expect(status.activity.predecessorActivityID).toBe(delivered.id);

  expect(context.getBroadcasts()).toStrictEqual([
    {
      status: { avatarID: viewer.avatar.id, kind: 'session-expired' },
      type: WorkerMessageType.ResyncStatus,
    },
  ]);
});

test('it delivers a start minted offline on a reconnect after offline and mints behind it', async () => {
  const viewer = await createViewer({ avatar: { xp: 400 } });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_matrix',
    client,
    submitter: createStubSubmitter(),
  });

  await setupStartableNode(viewer.avatar.id);

  const next = createMockNodeSeed({
    avatarID: viewer.avatar.id,
    encounterNode: { difficulty: 1 },
    nodeID: '1_0',
  });

  await writeNodeSeeds(viewer.avatar.id, [next]);

  await writeContentDocumentCache(
    createMockContentDocument({ contentVersion: next.contentVersion }),
  );

  const delivered = await db.activityCollection.create({
    appendedHead: 1,
    avatarID: viewer.avatar.id,
    buildSnapshot: { level: buildLevelFromXP(400), xp: 400 },
    status: 'stopped',
    verifiedHead: 0,
  });

  await db.checkpointCollection.create({
    activityID: delivered.id,
    payload: {
      chainIndex: 1,
      entropySource: 'server-key',
      nextSeed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
      rewards: { xp: 9 },
      seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
      time: 1000,
      type: 'failed',
    },
    version: 1,
  });

  await handleReportOnlineMessage(context, { avatarID: viewer.avatar.id, claim: true });

  context.getLifecycle().send({ type: 'OFFLINE' });

  const offline = await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  invariant(offline.kind === 'started', 'expected the offline start to mint locally');

  await handleReportOnlineMessage(context, { avatarID: viewer.avatar.id, claim: false });

  const status = await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '1_0',
    scopeType: 'world_map_node',
  });

  invariant(status.kind === 'started', 'expected the next start to mint behind the offline one');

  const remaining = await readAllActivityStarts();

  expect(status.activity.buildSnapshot).toStrictEqual({ level: buildLevelFromXP(409), xp: 409 });
  expect(status.activity.predecessorActivityID).toBe(offline.activity.id);
  expect(remaining.map((row) => row.id)).toStrictEqual([status.activity.id]);

  expect(context.getBroadcasts()).toStrictEqual([
    { activityID: offline.activity.id, type: WorkerMessageType.ActivityStartIngested },
  ]);
});

test("it drops a start refused because its predecessor is no longer active and mints from the server's row", async () => {
  const viewer = await createViewer({ avatar: { xp: 400 } });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_matrix',
    client,
    submitter: createStubSubmitter(),
  });

  await setupStartableNode(viewer.avatar.id);

  const delivered = await db.activityCollection.create({
    appendedHead: 1,
    avatarID: viewer.avatar.id,
    buildSnapshot: { level: buildLevelFromXP(400), xp: 400 },
    status: 'stopped',
    verifiedHead: 0,
  });

  await db.checkpointCollection.create({
    activityID: delivered.id,
    payload: {
      chainIndex: 1,
      entropySource: 'server-key',
      nextSeed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
      rewards: { xp: 9 },
      seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
      time: 1000,
      type: 'failed',
    },
    version: 1,
  });

  // a start minted before the delivered run's terminal total reached the server's fold, so its
  // snapshot can never match again; its run kept simulating here with a checkpoint queued behind it
  const refused = createMockActivityData({
    avatarID: viewer.avatar.id,
    buildSnapshot: { level: buildLevelFromXP(400), xp: 400 },
    id: 'act_matrix_refused',
    predecessorActivityID: delivered.id,
    scopeID: '0_0',
    startKey: 'start_key_matrix_refused',
  });

  await writeActivityStart(refused);
  await writeLastStartedActivity({ avatarID: viewer.avatar.id, lastActivityID: refused.id });
  await writeQueuedCheckpoint(refused.id, createMockCheckpointBatchEntry({ version: 1 }));

  const simulation = createSimulation();

  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: refused.id }));
  context.setSimulation(simulation);
  context.setActivity(refused);

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.CHECKPOINT_INVALID({
        data: {
          activityID: refused.id,
          appendedHead: 0,
          avatarID: viewer.avatar.id,
          reason: 'build-snapshot-mismatch',
        },
      });
    }),
  );

  await handleReportOnlineMessage(context, { avatarID: viewer.avatar.id, claim: true });

  const status = await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  invariant(status.kind === 'started', 'expected the retried start to mint');

  const remaining = await readAllActivityStarts();

  expect(status.activity.buildSnapshot).toStrictEqual({ level: buildLevelFromXP(409), xp: 409 });
  expect(status.activity.predecessorActivityID).toBe(delivered.id);
  expect(remaining.map((row) => row.id)).toStrictEqual([status.activity.id]);
  expect(readQueuedCheckpoints(refused.id)).resolves.toStrictEqual([]);

  expect(context.getBroadcasts()).toStrictEqual([
    {
      state: { failureAction: ActivityFailureAction.Abort },
      type: WorkerMessageType.SimulationUpdate,
    },
    {
      outcome: {
        activityID: refused.id,
        avatarID: viewer.avatar.id,
        kind: RunOutcomeKind.Refused,
        scope: { scopeID: '0_0', scopeType: 'world_map_node' },
        xp: 0,
      },
      type: WorkerMessageType.ActivityEnded,
    },
  ]);
});
