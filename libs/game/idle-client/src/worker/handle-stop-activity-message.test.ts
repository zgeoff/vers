import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { ActivityFailureAction, createSimulation } from '@vers/idle-core';
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
import { writePendingStartIntent } from '../submission/write-pending-start-intent';
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createTestConnection } from '../test-utils/create-test-connection';
import { ClientMessageType, WorkerMessageType } from '../types';
import { handleStopActivityMessage } from './handle-stop-activity-message';

test('it halts the live simulation and clears the runtime', async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });
  const simulation = createSimulation();
  const activity = createMockActivityData();

  context.setSimulation(simulation);
  context.setActivity(activity);

  await writePendingStartIntent({
    activityID: activity.id,
    avatarID: activity.avatarID,
    scopeID: activity.scopeID,
    scopeType: activity.scopeType,
  });

  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await handleStopActivityMessage(context, {
    activityID: activity.id,
    avatarID: activity.avatarID,
    type: ClientMessageType.StopActivity,
  });

  expect(simulation.activity).toBeNull();
  expect(context.getActivity()).toBeNull();
  expect(await readPendingStartIntent()).toBeUndefined();
});

test('it replaces the stopped simulation with a fresh empty one', async () => {
  const context = createStubWorkerContext({ submitter: createStubSubmitter() });
  const simulation = createSimulation();
  const activity = createMockActivityData();

  context.setSimulation(simulation);
  context.setActivity(activity);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await handleStopActivityMessage(context, {
    activityID: activity.id,
    avatarID: activity.avatarID,
    type: ClientMessageType.StopActivity,
  });

  const replacement = context.getSimulation();

  invariant(replacement !== null, 'expected a replacement simulation');
  expect(replacement).not.toBe(simulation);

  expect(replacement.getSnapshot()).toStrictEqual({
    failureAction: ActivityFailureAction.Abort,
  });
});

test('it broadcasts a cleared snapshot to every connection', async () => {
  const connection = createTestConnection();

  const context = createStubWorkerContext({
    connections: [connection.port],
    submitter: createStubSubmitter(),
  });

  const simulation = createSimulation();
  const activity = createMockActivityData();

  context.setSimulation(simulation);
  context.setActivity(activity);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await handleStopActivityMessage(context, {
    activityID: activity.id,
    avatarID: activity.avatarID,
    type: ClientMessageType.StopActivity,
  });

  await connection.waitForMessages(1);

  expect(connection.received).toPartiallyContain({
    state: { failureAction: ActivityFailureAction.Abort },
    type: WorkerMessageType.SimulationUpdate,
  });
});

test('it resets the reward-slot ledger', async () => {
  const context = createStubWorkerContext({ submitter: createStubSubmitter() });
  const activity = createMockActivityData();

  context.setActivity(activity);
  context.recordRewardSlots(activity.id, { count: 2, version: 1 });

  await handleStopActivityMessage(context, {
    activityID: activity.id,
    avatarID: activity.avatarID,
    type: ClientMessageType.StopActivity,
  });

  expect(context.getRewardSlotLedger()).toStrictEqual({ activityID: null, entries: [] });
});

test('it advances the stop epoch so in-flight installs abandon', async () => {
  const context = createStubWorkerContext({ submitter: createStubSubmitter() });
  const activity = createMockActivityData();

  context.setActivity(activity);

  const entryEpoch = context.getStopEpoch();

  await handleStopActivityMessage(context, {
    activityID: activity.id,
    avatarID: activity.avatarID,
    type: ClientMessageType.StopActivity,
  });

  expect(context.getStopEpoch()).toBe(entryEpoch + 1);
});

test('it delivers the targeted server stop and releases the intent', async () => {
  const viewer = await createViewer();
  const row = await db.activityCollection.create({ avatarID: viewer.avatar.id, status: 'active' });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ client, submitter });

  await handleStopActivityMessage(context, {
    activityID: row.id,
    avatarID: viewer.avatar.id,
    type: ClientMessageType.StopActivity,
  });

  const stopped = db.activityCollection.findFirst((q) => q.where({ id: row.id }));

  invariant(stopped !== undefined, 'expected the targeted row to survive');
  expect(stopped.status).toBe('stopped');
  expect(submitter.flushNow).toHaveBeenCalledExactlyOnceWith(row.id);

  const intent = await readPendingStopIntent();

  expect(intent).toBeUndefined();
});

test('it keeps the intent held when delivery fails, with the local halt already done', async () => {
  server.use(mockActivityService.stopActivity.handler(() => HttpResponse.error()));

  const context = createStubWorkerContext({ submitter: createStubSubmitter() });
  const simulation = createSimulation();
  const activity = createMockActivityData();

  context.setSimulation(simulation);
  context.setActivity(activity);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await handleStopActivityMessage(context, {
    activityID: activity.id,
    avatarID: activity.avatarID,
    type: ClientMessageType.StopActivity,
  });

  expect(simulation.activity).toBeNull();
  expect(context.getActivity()).toBeNull();

  const intent = await readPendingStopIntent();

  expect(intent).toStrictEqual({
    activityID: activity.id,
    avatarID: activity.avatarID,
  });
});

test('it halts nothing but still delivers when no simulation is installed', async () => {
  const viewer = await createViewer();
  const row = await db.activityCollection.create({ avatarID: viewer.avatar.id, status: 'active' });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client, submitter: createStubSubmitter() });
  const entryEpoch = context.getStopEpoch();

  await handleStopActivityMessage(context, {
    activityID: row.id,
    avatarID: viewer.avatar.id,
    type: ClientMessageType.StopActivity,
  });

  expect(context.getStopEpoch()).toBe(entryEpoch + 1);
  expect(context.getSimulation()).not.toBeNull();

  const stopped = db.activityCollection.findFirst((q) => q.where({ id: row.id }));

  invariant(stopped !== undefined, 'expected the targeted row to survive');
  expect(stopped.status).toBe('stopped');
});

test('it ignores a stop naming an older activity than the live one', async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });
  const simulation = createSimulation();
  const live = createMockActivityData();

  context.setSimulation(simulation);
  context.setActivity(live);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  const entryEpoch = context.getStopEpoch();

  await handleStopActivityMessage(context, {
    activityID: 'activity_older',
    avatarID: live.avatarID,
    type: ClientMessageType.StopActivity,
  });

  expect(context.getSimulation()).toBe(simulation);
  expect(context.getActivity()).toStrictEqual(live);
  expect(context.getStopEpoch()).toBe(entryEpoch);

  const intent = await readPendingStopIntent();

  expect(intent).toBeUndefined();
});
