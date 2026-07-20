import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createSimulation } from '@vers/idle-core';
import { createMockActivityInput, createMockAvatarData } from '@vers/idle-core/test-utils';
import { createAuthedServiceClient } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { HttpResponse } from 'msw';
import invariant from 'tiny-invariant';
import { server } from '../mocks/node';
import { readPendingStopIntent } from '../submission/read-pending-stop-intent';
import type { ActivityServiceClient } from '../submission/types';
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createTestConnection } from '../test-utils/create-test-connection';
import { WorkerMessageType } from '../types';
import { runContinuation } from './run-continuation';

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
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ client: ctx.client, submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData({ avatarID: avatar.id });

  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await runContinuation(context, simulation, previousActivity);

  const minted = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: avatar.id, status: 'active' }),
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

test('it adopts the CONFLICT payload row when one is already active for the scope', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  const conflictingActivity = await db.activityCollection.create({
    avatarID: avatar.id,
    status: 'active',
  });

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ client: ctx.client, submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData({ avatarID: avatar.id });

  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await runContinuation(context, simulation, previousActivity);

  expect(simulation.activity?.id).toBe(conflictingActivity.id);
  expect(context.getActivity()).toStrictEqual(conflictingActivity);

  expect(submitter.registerActivity).toHaveBeenCalledExactlyOnceWith({
    activityID: conflictingActivity.id,
    appendedHead: 0,
    lastHash: conflictingActivity.startHash,
    startChainIndex: conflictingActivity.startChainIndex,
  });
});

test('it stops the simulation and broadcasts offline on a transport failure', async () => {
  server.use(mockActivityService.startActivity.handler(() => HttpResponse.error()));

  const connection = createTestConnection();
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ connections: [connection.port], submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData();

  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await runContinuation(context, simulation, previousActivity);

  expect(simulation.activity).toBeNull();
  expect(submitter.registerActivity).not.toHaveBeenCalled();

  await connection.waitForMessages(1);

  expect(connection.received).toStrictEqual([
    { online: false, type: WorkerMessageType.ConnectionStatus },
  ]);
});

test('it records a pending continuation on a transport failure', async () => {
  server.use(mockActivityService.startActivity.handler(() => HttpResponse.error()));

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData();

  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await runContinuation(context, simulation, previousActivity);

  expect(context.getPendingContinuation()).toStrictEqual({
    activityID: previousActivity.id,
    avatarID: previousActivity.avatarID,
    scopeID: previousActivity.scopeID,
    scopeType: previousActivity.scopeType,
  });
});

test('it stops the simulation and records a pending continuation on a same-row CONFLICT', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });
  const activity = await db.activityCollection.create({ avatarID: avatar.id, status: 'active' });

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ client: ctx.client, submitter });
  const simulation = createSimulation();

  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await runContinuation(context, simulation, activity);

  expect(simulation.activity).toBeNull();

  expect(context.getPendingContinuation()).toStrictEqual({
    activityID: activity.id,
    avatarID: activity.avatarID,
    scopeID: activity.scopeID,
    scopeType: activity.scopeType,
  });
});

test('it records no pending continuation when the CONFLICT names a different, already-progressed row', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  await db.activityCollection.create({
    appendedHead: 3,
    avatarID: avatar.id,
    status: 'active',
  });

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ client: ctx.client, submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData({ avatarID: avatar.id });

  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await runContinuation(context, simulation, previousActivity);

  expect(context.getPendingContinuation()).toBeNull();
});

test('it records no pending continuation on a defined error other than CONFLICT', async () => {
  server.use(
    mockActivityService.startActivity.handler((opts) => {
      throw opts.errors.CHAIN_QUARANTINED({ data: {} });
    }),
  );

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData();

  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await runContinuation(context, simulation, previousActivity);

  expect(context.getPendingContinuation()).toBeNull();
});

test('it stops the row it started when a stop lands mid-flight', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ client: ctx.client, submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData({ avatarID: avatar.id });

  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  // the stop lands while the start call is in flight: the deviation answers with the row the
  // continuation minted, then advances the epoch as a concurrent stop does
  const started = await db.activityCollection.create({ avatarID: avatar.id, status: 'active' });

  server.use(
    mockActivityService.startActivity.handler(() => {
      context.advanceStopEpoch();

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

test('it records no pending continuation for a same-row CONFLICT after a stop lands', async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData();

  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  server.use(
    mockActivityService.startActivity.handler((opts) => {
      context.advanceStopEpoch();
      throw opts.errors.CONFLICT({ data: { activity: previousActivity } });
    }),
  );

  await runContinuation(context, simulation, previousActivity);

  expect(context.getPendingContinuation()).toBeNull();
});

test('it leaves a replacement simulation installed when uninstalling after a stop', async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });
  const simulation = createSimulation();
  const replacement = createSimulation();
  const previousActivity = createMockActivityData();

  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  server.use(
    mockActivityService.startActivity.handler(() => {
      context.advanceStopEpoch();
      context.setSimulation(replacement);

      return HttpResponse.error();
    }),
  );

  await runContinuation(context, simulation, previousActivity);

  expect(context.getSimulation()).toBe(replacement);
  expect(context.getPendingContinuation()).toBeNull();
});
