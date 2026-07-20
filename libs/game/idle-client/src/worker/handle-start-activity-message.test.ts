import { expect, test } from 'bun:test';
import { createSimulation } from '@vers/idle-core';
import { createAuthedServiceClient, createViewer } from '@vers/mock-services';
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
import type { StartActivityMessage } from '../types';
import { ClientMessageType, WorkerMessageType } from '../types';
import { handleStartActivityMessage } from './handle-start-activity-message';

interface SetupTestConfig {
  readonly userID: string;
}

/**
 * Builds an authed client acting as the given user, so start intents hit the same mint, conflict,
 * and duplicate-start logic the real service applies to the rows the test seeds in the mock db.
 */
async function setupTest(config: Readonly<SetupTestConfig>) {
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', config.userID);

  return { client };
}

test('it mints a row, installs it, and broadcasts the started status', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const connection = createTestConnection();
  const submitter = createStubSubmitter();

  const context = createStubWorkerContext({
    client: ctx.client,
    connections: [connection.port],
    submitter,
  });

  context.setSimulation(createSimulation());

  const message: StartActivityMessage = {
    avatarID: viewer.avatar.id,
    requestID: 'request_start',
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    type: ClientMessageType.StartActivity,
  };

  await handleStartActivityMessage(context, message);

  const minted = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: viewer.avatar.id, status: 'active' }),
  );

  invariant(minted !== undefined, 'expected the start to mint an active row');
  expect(minted.scopeID).toBe('a9lp75');
  expect(minted.startKey).toBe(message.requestID);
  expect(context.getSimulation()?.activity?.id).toBe(minted.id);
  expect(context.getActivity()?.id).toBe(minted.id);

  expect(submitter.registerActivity).toHaveBeenCalledExactlyOnceWith({
    activityID: minted.id,
    appendedHead: 0,
    lastHash: minted.lastHash,
    startChainIndex: minted.startChainIndex,
  });

  await connection.waitForMessages(1);

  const report = connection.received.find(
    (received) => received.type === WorkerMessageType.StartStatus,
  );

  invariant(report?.type === WorkerMessageType.StartStatus, 'expected a start status broadcast');
  expect(report.requestID).toBe(message.requestID);
  invariant(report.status.kind === 'started', 'expected a started status');
  expect(report.status.activity.id).toBe(minted.id);
});

test('it installs a simulation even when none was initialized yet', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const context = createStubWorkerContext({ client: ctx.client, submitter: createStubSubmitter() });

  await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    requestID: 'request_start',
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    type: ClientMessageType.StartActivity,
  });

  const minted = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: viewer.avatar.id, status: 'active' }),
  );

  invariant(minted !== undefined, 'expected the start to mint an active row');
  expect(context.getSimulation()?.activity?.id).toBe(minted.id);
});

test('it answers a duplicate delivery with the row the first attempt minted', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const connection = createTestConnection();

  const context = createStubWorkerContext({
    client: ctx.client,
    connections: [connection.port],
    submitter: createStubSubmitter(),
  });

  context.setSimulation(createSimulation());

  const message: StartActivityMessage = {
    avatarID: viewer.avatar.id,
    requestID: 'request_start',
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    type: ClientMessageType.StartActivity,
  };

  // the first delivery already minted the row, keyed by this same request
  const existing = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    startKey: message.requestID,
    status: 'active',
  });

  await handleStartActivityMessage(context, message);

  const rows = db.activityCollection.findMany((q) => q.where({ avatarID: viewer.avatar.id }));

  expect(rows).toHaveLength(1);
  expect(context.getSimulation()?.activity?.id).toBe(existing.id);

  await connection.waitForMessages(1);

  const report = connection.received.find(
    (received) => received.type === WorkerMessageType.StartStatus,
  );

  invariant(report?.type === WorkerMessageType.StartStatus, 'expected a start status broadcast');
  expect(report.requestID).toBe(message.requestID);
  invariant(report.status.kind === 'started', 'expected a started status');
  expect(report.status.activity.id).toBe(existing.id);
});

test('it resyncs onto the already-active row when the same scope conflicts', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const running = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    startKey: 'someone-elses-start',
    status: 'active',
  });

  const connection = createTestConnection();

  const context = createStubWorkerContext({
    client: ctx.client,
    connections: [connection.port],
    submitter: createStubSubmitter(),
  });

  const message: StartActivityMessage = {
    avatarID: viewer.avatar.id,
    requestID: 'request_start',
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    type: ClientMessageType.StartActivity,
  };

  await handleStartActivityMessage(context, message);

  expect(context.getSimulation()?.activity?.id).toBe(running.id);

  await connection.waitForMessages(1);

  expect(connection.received).toContainEqual({
    requestID: message.requestID,
    status: { activityID: running.id, kind: 'attached' },
    type: WorkerMessageType.StartStatus,
  });
});

test('it flushes and stops a different scope before starting the requested one', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const previous = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    scopeID: 'old-node',
    scopeType: 'world_map_node',
    status: 'active',
  });

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ client: ctx.client, submitter });

  context.setSimulation(createSimulation());

  await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    requestID: 'request_start',
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    type: ClientMessageType.StartActivity,
  });

  const stopped = db.activityCollection.findFirst((q) => q.where({ id: previous.id }));

  invariant(stopped !== undefined, 'expected the previous row to survive');
  expect(stopped.status).toBe('stopped');
  expect(submitter.flushNow).toHaveBeenCalledExactlyOnceWith(previous.id);

  const minted = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: viewer.avatar.id, status: 'active' }),
  );

  invariant(minted !== undefined, 'expected the start to mint an active row');
  expect(minted.scopeID).toBe('a9lp75');
  expect(context.getSimulation()?.activity?.id).toBe(minted.id);
});

test('it stops the minted row back when a stop lands mid-start', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const connection = createTestConnection();

  const context = createStubWorkerContext({
    client: ctx.client,
    connections: [connection.port],
    submitter: createStubSubmitter(),
  });

  context.setSimulation(createSimulation());

  const message: StartActivityMessage = {
    avatarID: viewer.avatar.id,
    requestID: 'request_start',
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    type: ClientMessageType.StartActivity,
  };

  // the stop lands while the start call is in flight
  const minted = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    startKey: message.requestID,
    status: 'active',
  });

  server.use(
    mockActivityService.startActivity.handler(() => {
      context.advanceStopEpoch();

      return minted;
    }),
  );

  await handleStartActivityMessage(context, message);

  const row = db.activityCollection.findFirst((q) => q.where({ id: minted.id }));

  invariant(row !== undefined, 'expected the minted row to survive');
  expect(row.status).toBe('stopped');
  expect(context.getActivity()).toBeNull();

  const intent = await readPendingStopIntent();

  expect(intent).toBeUndefined();

  await connection.waitForMessages(1);

  expect(connection.received).toContainEqual({
    requestID: message.requestID,
    status: { kind: 'failed' },
    type: WorkerMessageType.StartStatus,
  });
});

test('it abandons a superseded request without touching the fresher claim', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const context = createStubWorkerContext({ client: ctx.client, submitter: createStubSubmitter() });

  context.setSimulation(createSimulation());

  const message: StartActivityMessage = {
    avatarID: viewer.avatar.id,
    requestID: 'request_start',
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    type: ClientMessageType.StartActivity,
  };

  const minted = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    startKey: message.requestID,
    status: 'active',
  });

  // a fresher selection claims the runtime while this request's start call is in flight
  server.use(
    mockActivityService.startActivity.handler(() => {
      context.setStartRequestID('a-fresher-request');

      return minted;
    }),
  );

  await handleStartActivityMessage(context, message);

  const row = db.activityCollection.findFirst((q) => q.where({ id: minted.id }));

  invariant(row !== undefined, 'expected the minted row to survive');
  expect(row.status).toBe('active');
  expect(context.getActivity()).toBeNull();
});

test('it broadcasts failed on a transport failure', async () => {
  server.use(mockActivityService.startActivity.handler(() => HttpResponse.error()));

  const connection = createTestConnection();

  const context = createStubWorkerContext({
    connections: [connection.port],
    submitter: createStubSubmitter(),
  });

  const message: StartActivityMessage = {
    avatarID: 'avatar_1',
    requestID: 'request_start',
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    type: ClientMessageType.StartActivity,
  };

  await handleStartActivityMessage(context, message);

  await connection.waitForMessages(1);

  expect(connection.received).toStrictEqual([
    {
      requestID: message.requestID,
      status: { kind: 'failed' },
      type: WorkerMessageType.StartStatus,
    },
  ]);
});

test('it fails an attach the resync could not install', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    startKey: 'someone-elses-start',
    status: 'active',
  });

  const connection = createTestConnection();

  const context = createStubWorkerContext({
    client: ctx.client,
    connections: [connection.port],
    submitter: createStubSubmitter(),
  });

  // the attach resync's own progress fetch fails, so it installs nothing — the status must not
  // promise a row the runtime never installed
  server.use(mockActivityService.getLatestActivityProgress.handler(() => HttpResponse.error()));

  const message: StartActivityMessage = {
    avatarID: viewer.avatar.id,
    requestID: 'request_start',
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    type: ClientMessageType.StartActivity,
  };

  await handleStartActivityMessage(context, message);

  expect(context.getSimulation().activity).toBeNull();

  await connection.waitForMessages(2);

  expect(connection.received).toStrictEqual([
    {
      status: { avatarID: viewer.avatar.id, kind: 'failed' },
      type: WorkerMessageType.ResyncStatus,
    },
    {
      requestID: message.requestID,
      status: { kind: 'failed' },
      type: WorkerMessageType.StartStatus,
    },
  ]);
});

test('it runs interleaved starts one at a time, the fresher claim winning', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const context = createStubWorkerContext({ client: ctx.client, submitter: createStubSubmitter() });

  context.setSimulation(createSimulation());

  const first: StartActivityMessage = {
    avatarID: viewer.avatar.id,
    requestID: 'request_first',
    scopeID: 'esaxrt',
    scopeType: 'world_map_node',
    type: ClientMessageType.StartActivity,
  };

  const second: StartActivityMessage = {
    avatarID: viewer.avatar.id,
    requestID: 'request_second',
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    type: ClientMessageType.StartActivity,
  };

  // both messages land before either flow runs — the chain must run them in order, so the first
  // completes fully before the second's conflict recovery replaces its row
  await Promise.all([
    handleStartActivityMessage(context, first),
    handleStartActivityMessage(context, second),
  ]);

  const active = db.activityCollection.findMany((q) =>
    q.where({ avatarID: viewer.avatar.id, status: 'active' }),
  );

  expect(active).toHaveLength(1);
  invariant(active[0] !== undefined, 'expected one active row');
  expect(active[0].scopeID).toBe('a9lp75');
  expect(context.getActivity()?.id).toBe(active[0].id);
});

test('it takes over and stops a different scope another writer owns before starting the requested one', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const previous = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    scopeID: 'old-node',
    scopeType: 'world_map_node',
    status: 'active',
  });

  // the conflicting run belongs to another device's writer until this session claims it back
  let claimed = false;

  server.use(
    mockActivityService.stopActivity.handler((opts) => {
      if (!claimed) {
        throw opts.errors.SESSION_EVICTED({ data: {} });
      }

      const row = db.activityCollection.findFirst((q) => q.where({ id: previous.id }));

      invariant(row !== undefined, 'expected the previous row to survive the stop');

      return db.activityCollection.update(row, {
        data(record) {
          record.status = 'stopped';
        },
        strict: true,
      });
    }),
    mockActivityService.resumeActivity.handler(() => {
      claimed = true;

      return previous;
    }),
  );

  const context = createStubWorkerContext({ client: ctx.client });

  context.setSimulation(createSimulation());

  await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    requestID: 'request_takeover_start',
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    type: ClientMessageType.StartActivity,
  });

  const stopped = db.activityCollection.findFirst((q) => q.where({ id: previous.id }));

  invariant(stopped !== undefined, 'expected the previous row to survive');
  expect(stopped.status).toBe('stopped');

  const minted = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: viewer.avatar.id, status: 'active' }),
  );

  invariant(minted !== undefined, 'expected the start to mint an active row');
  expect(minted.scopeID).toBe('a9lp75');
  expect(context.getSimulation()?.activity?.id).toBe(minted.id);
});
