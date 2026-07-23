import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createSimulation } from '@vers/idle-core';
import { createMockActivityInput, createMockAvatarData } from '@vers/idle-core/test-utils';
import { createAuthedServiceClient, createViewer } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { HttpResponse } from 'msw';
import invariant from 'tiny-invariant';
import { server } from '../mocks/node';
import { readPendingStartIntent } from '../submission/read-pending-start-intent';
import { readPendingStopIntent } from '../submission/read-pending-stop-intent';
import type { ActivityServiceClient } from '../submission/types';
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { WorkerMessageType } from '../types';
import { runContinuation } from './run-continuation';
import type { WorkerContext } from './types';

interface SetupTestConfig {
  readonly userID: string;
}

/**
 * Builds an authed client acting as the given user, so
 * continuation starts hit the same conflict/mint logic the real service applies to the rows the
 * test seeds in the mock db.
 */
async function setupTest(config: Readonly<SetupTestConfig>) {
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', config.userID);

  return { client };
}

test('it adopts a fresh server-started row for the same scope and registers from a zero cursor', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ client: ctx.client, submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData({ avatarID: viewer.avatar.id });

  context.setSimulation(simulation);
  context.setActivity(previousActivity);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await runContinuation(context, simulation, previousActivity);

  const minted = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: viewer.avatar.id, status: 'active' }),
  );

  invariant(minted !== undefined, 'expected the continuation to mint an active row');

  expect(minted.scopeID).toBe(previousActivity.scopeID);
  expect(simulation.activity?.id).toBe(minted.id);
  expect(context.getActivity()).toStrictEqual(minted);

  expect(submitter.registerActivity).toHaveBeenCalledExactlyOnceWith({
    activityID: minted.id,
    appendedHead: 0,
    lastHash: minted.startHash,
    startChainIndex: minted.startChainIndex,
  });
});

test('it hands a foreign-claim CONFLICT to a resync that attaches the conflicting row', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const conflictingActivity = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    status: 'active',
  });

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ client: ctx.client, submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData({ avatarID: viewer.avatar.id });

  context.setSimulation(simulation);
  context.setActivity(previousActivity);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await runContinuation(context, simulation, previousActivity);

  expect(simulation.activity).toBeNull();

  const installed = context.getSimulation();

  expect(installed).not.toBe(simulation);
  expect(installed.activity?.id).toBe(conflictingActivity.id);
  expect(context.getActivity()).toStrictEqual(conflictingActivity);

  const heldIntent = await readPendingStartIntent();

  expect(heldIntent).toBeUndefined();

  expect(submitter.registerActivity).toHaveBeenCalledExactlyOnceWith({
    activityID: conflictingActivity.id,
    appendedHead: 0,
    lastHash: conflictingActivity.lastHash,
    startChainIndex: conflictingActivity.startChainIndex,
  });
});

test('it stops the simulation and marks connectivity offline on a transport failure', async () => {
  server.use(mockActivityService.startActivity.handler(() => HttpResponse.error()));

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData();

  context.setSimulation(simulation);
  context.setActivity(previousActivity);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await runContinuation(context, simulation, previousActivity);

  expect(simulation.activity).toBeNull();
  expect(submitter.registerActivity).not.toHaveBeenCalled();
  expect(context.getConnectivityOnline()).toBeFalse();
});

test('it records a durable start intent on a transport failure', async () => {
  server.use(mockActivityService.startActivity.handler(() => HttpResponse.error()));

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData();

  context.setSimulation(simulation);
  context.setActivity(previousActivity);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await runContinuation(context, simulation, previousActivity);

  const heldIntent = await readPendingStartIntent();

  expect(heldIntent).toStrictEqual({
    activityID: previousActivity.id,
    avatarID: previousActivity.avatarID,
    scopeID: previousActivity.scopeID,
    scopeType: previousActivity.scopeType,
  });
});

test('it stops the simulation and records a durable start intent on a same-row CONFLICT', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const activity = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    status: 'active',
  });

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ client: ctx.client, submitter });
  const simulation = createSimulation();

  context.setSimulation(simulation);
  context.setActivity(activity);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await runContinuation(context, simulation, activity);

  expect(simulation.activity).toBeNull();

  const heldIntent = await readPendingStartIntent();

  expect(heldIntent).toStrictEqual({
    activityID: activity.id,
    avatarID: activity.avatarID,
    scopeID: activity.scopeID,
    scopeType: activity.scopeType,
  });
});

test('it records no start intent when the CONFLICT names a different, already-progressed row', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  await db.activityCollection.create({
    appendedHead: 3,
    avatarID: viewer.avatar.id,
    status: 'active',
  });

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ client: ctx.client, submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData({ avatarID: viewer.avatar.id });

  context.setSimulation(simulation);
  context.setActivity(previousActivity);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await runContinuation(context, simulation, previousActivity);

  const heldIntent = await readPendingStartIntent();

  expect(heldIntent).toBeUndefined();
});

test('it records no start intent on a defined error other than CONFLICT', async () => {
  server.use(
    mockActivityService.startActivity.handler((opts) => {
      throw opts.errors.CHAIN_QUARANTINED({ data: {} });
    }),
  );

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData();

  context.setSimulation(simulation);
  context.setActivity(previousActivity);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await runContinuation(context, simulation, previousActivity);

  const heldIntent = await readPendingStartIntent();

  expect(heldIntent).toBeUndefined();
});

test('it stops the row it started when a stop lands mid-flight', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ client: ctx.client, submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData({ avatarID: viewer.avatar.id });

  context.setSimulation(simulation);
  context.setActivity(previousActivity);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  // the stop lands while the start call is in flight: the deviation answers with the row the
  // continuation minted, then advances the stop scope as a concurrent stop does
  const started = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    status: 'active',
  });

  server.use(
    mockActivityService.startActivity.handler(() => {
      context.advanceStopScope();

      return started;
    }),
  );

  await runContinuation(context, simulation, previousActivity);

  expect(submitter.registerActivity).not.toHaveBeenCalled();

  const row = db.activityCollection.findFirst((q) => q.where({ id: started.id }));

  invariant(row !== undefined, 'expected the started row to survive');

  expect(row.status).toBe('stopped');

  const intent = await readPendingStopIntent();

  expect(intent).toBeUndefined();
});

test('it records no start intent for a same-row CONFLICT after a stop lands', async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData();

  context.setSimulation(simulation);
  context.setActivity(previousActivity);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  server.use(
    mockActivityService.startActivity.handler((opts) => {
      context.advanceStopScope();
      throw opts.errors.CONFLICT({ data: { activity: previousActivity } });
    }),
  );

  await runContinuation(context, simulation, previousActivity);

  const heldIntent = await readPendingStartIntent();

  expect(heldIntent).toBeUndefined();
});

test('it compensates a stop that lands while the intent write is committing', async () => {
  server.use(mockActivityService.startActivity.handler(() => HttpResponse.error()));

  const submitter = createStubSubmitter();
  const base = createStubWorkerContext({ submitter });

  // Models the untimeable gap between the pre-write stop guard and the write's transaction
  // committing: the guard reads the captured signal as not yet aborted, and the stop's abort is
  // only visible by the post-write re-check. Both reads land on the one signal captured at entry
  // — pre-write guard, then post-write re-check — so the scripted sequence hands the aborted
  // state to the re-check alone.
  const abortReads = [false, true];

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a hand-built stub exposing only the `aborted` getter every check site reads; a real AbortSignal can't be built with a scripted sequence
  const fakeSignal = {
    get aborted() {
      return abortReads.shift() ?? true;
    },
  } as unknown as AbortSignal;

  const context: WorkerContext = {
    ...base,
    getCancelSignal: () => fakeSignal,
    getStopSignal: () => fakeSignal,
  };

  const simulation = createSimulation();
  const previousActivity = createMockActivityData();

  context.setSimulation(simulation);
  context.setActivity(previousActivity);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await runContinuation(context, simulation, previousActivity);

  const heldIntent = await readPendingStartIntent();

  expect(heldIntent).toBeUndefined();
});

test('it leaves a replacement simulation installed when uninstalling after a stop', async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });
  const simulation = createSimulation();
  const replacement = createSimulation();
  const previousActivity = createMockActivityData();

  context.setSimulation(simulation);
  context.setActivity(previousActivity);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  server.use(
    mockActivityService.startActivity.handler(() => {
      context.advanceStopScope();
      context.setSimulation(replacement);

      return HttpResponse.error();
    }),
  );

  await runContinuation(context, simulation, previousActivity);

  expect(context.getSimulation()).toBe(replacement);

  const heldIntent = await readPendingStartIntent();

  expect(heldIntent).toBeUndefined();
});

test('it broadcasts the avatar-switched status when the continuation avatar is no longer active, rather than resetting to idle silently', async () => {
  const viewer = await createViewer({ avatar: { id: 'avatar_active', name: 'Active One' } });
  const targetAvatar = await db.avatarCollection.create({ userID: viewer.user.id });
  const ctx = await setupTest({ userID: viewer.user.id });

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ client: ctx.client, submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData({ avatarID: targetAvatar.id });

  context.setSimulation(simulation);
  context.setActivity(previousActivity);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await runContinuation(context, simulation, previousActivity);

  expect(context.getActivity()).toBeNull();

  expect(context.getBroadcasts()).toPartiallyContain({
    status: { activeAvatarName: 'Active One', attempts: 0, kind: 'avatar-switched', levelUps: 0 },
    type: WorkerMessageType.ResyncStatus,
  });

  expect(context.getConnectivityOnline()).toBeTrue();
});
