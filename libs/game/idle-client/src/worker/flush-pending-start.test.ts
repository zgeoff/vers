import { expect, test } from 'bun:test';
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
import { flushPendingStart } from './flush-pending-start';

test('it reports none when no intent is held', async () => {
  const context = createStubWorkerContext({ submitter: createStubSubmitter() });

  const result = await flushPendingStart(context, context.getStopEpoch(), 'avatar_1');

  expect(result).toStrictEqual({ outcome: 'none' });
});

test('it mints the continued row and releases the intent', async () => {
  const viewer = await createViewer();

  const source = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    status: 'stopped',
  });

  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client, submitter: createStubSubmitter() });

  await writePendingStartIntent({
    activityID: source.id,
    avatarID: viewer.avatar.id,
    scopeID: source.scopeID,
    scopeType: source.scopeType,
  });

  const result = await flushPendingStart(context, context.getStopEpoch(), viewer.avatar.id);

  const minted = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: viewer.avatar.id, status: 'active' }),
  );

  invariant(minted !== undefined, 'expected the delivery to mint an active row');
  invariant(result.outcome === 'delivered', 'expected the flush to deliver');

  expect(result.started.id).toBe(minted.id);
  expect(minted.scopeID).toBe(source.scopeID);
  expect(context.getSimulation().activity).toBeNull();

  const heldIntent = await readPendingStartIntent();

  expect(heldIntent).toBeUndefined();
});

test('it keeps the intent while the source row still reads active', async () => {
  const viewer = await createViewer();

  const source = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    status: 'active',
  });

  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client, submitter: createStubSubmitter() });

  await writePendingStartIntent({
    activityID: source.id,
    avatarID: viewer.avatar.id,
    scopeID: source.scopeID,
    scopeType: source.scopeType,
  });

  const result = await flushPendingStart(context, context.getStopEpoch(), viewer.avatar.id);

  expect(result).toStrictEqual({ outcome: 'blocked' });

  const heldIntent = await readPendingStartIntent();

  expect(heldIntent).toStrictEqual({
    activityID: source.id,
    avatarID: viewer.avatar.id,
    scopeID: source.scopeID,
    scopeType: source.scopeType,
  });
});

test('it releases a stale intent when a different claim owns the avatar', async () => {
  const viewer = await createViewer();

  const departed = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    status: 'stopped',
  });

  const foreign = await db.activityCollection.create({
    appendedHead: 2,
    avatarID: viewer.avatar.id,
    status: 'active',
  });

  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client, submitter: createStubSubmitter() });

  await writePendingStartIntent({
    activityID: departed.id,
    avatarID: viewer.avatar.id,
    scopeID: departed.scopeID,
    scopeType: departed.scopeType,
  });

  const result = await flushPendingStart(context, context.getStopEpoch(), viewer.avatar.id);

  expect(result).toStrictEqual({ outcome: 'stale' });

  const heldIntent = await readPendingStartIntent();

  expect(heldIntent).toBeUndefined();

  const survivor = db.activityCollection.findFirst((q) => q.where({ id: foreign.id }));

  invariant(survivor !== undefined, 'expected the foreign claim to survive');

  expect(survivor.status).toBe('active');
});

test("it leaves another avatar's intent untouched", async () => {
  const context = createStubWorkerContext({ submitter: createStubSubmitter() });

  await writePendingStartIntent({
    activityID: 'activity_1',
    avatarID: 'avatar_other',
    scopeID: 'scope_1',
    scopeType: 'mission',
  });

  const result = await flushPendingStart(context, context.getStopEpoch(), 'avatar_resyncing');

  expect(result).toStrictEqual({ outcome: 'none' });

  const heldIntent = await readPendingStartIntent();

  expect(heldIntent).not.toBeUndefined();
});

test('it skips the attempt and keeps the intent when the budget is spent', async () => {
  const context = createStubWorkerContext({
    remainingBudgetMs: 0,
    submitter: createStubSubmitter(),
  });

  await writePendingStartIntent({
    activityID: 'activity_1',
    avatarID: 'avatar_1',
    scopeID: 'scope_1',
    scopeType: 'mission',
  });

  const result = await flushPendingStart(context, context.getStopEpoch(), 'avatar_1');

  expect(result).toStrictEqual({ outcome: 'capped' });

  const heldIntent = await readPendingStartIntent();

  expect(heldIntent).toStrictEqual({
    activityID: 'activity_1',
    avatarID: 'avatar_1',
    scopeID: 'scope_1',
    scopeType: 'mission',
  });
});

test('it keeps the intent on a transport failure', async () => {
  server.use(mockActivityService.startActivity.handler(() => HttpResponse.error()));

  const context = createStubWorkerContext({ submitter: createStubSubmitter() });

  await writePendingStartIntent({
    activityID: 'activity_1',
    avatarID: 'avatar_1',
    scopeID: 'scope_1',
    scopeType: 'mission',
  });

  const result = await flushPendingStart(context, context.getStopEpoch(), 'avatar_1');

  expect(result).toStrictEqual({ outcome: 'undelivered' });

  const heldIntent = await readPendingStartIntent();

  expect(heldIntent).not.toBeUndefined();
});

test('it keeps the intent and rethrows when the session is not recognized', async () => {
  server.use(
    mockActivityService.startActivity.handler((opts) => {
      throw opts.errors.UNAUTHORIZED({ data: { reason: 'expired-session' } });
    }),
  );

  const context = createStubWorkerContext({ submitter: createStubSubmitter() });

  await writePendingStartIntent({
    activityID: 'activity_1',
    avatarID: 'avatar_1',
    scopeID: 'scope_1',
    scopeType: 'mission',
  });

  await expect(flushPendingStart(context, context.getStopEpoch(), 'avatar_1')).toReject();

  const heldIntent = await readPendingStartIntent();

  expect(heldIntent).toStrictEqual({
    activityID: 'activity_1',
    avatarID: 'avatar_1',
    scopeID: 'scope_1',
    scopeType: 'mission',
  });
});

test('it releases the intent and rethrows a defined error other than CONFLICT', async () => {
  server.use(
    mockActivityService.startActivity.handler((opts) => {
      throw opts.errors.CHAIN_QUARANTINED({ data: {} });
    }),
  );

  const context = createStubWorkerContext({ submitter: createStubSubmitter() });

  await writePendingStartIntent({
    activityID: 'activity_1',
    avatarID: 'avatar_1',
    scopeID: 'scope_1',
    scopeType: 'mission',
  });

  await expect(flushPendingStart(context, context.getStopEpoch(), 'avatar_1')).toReject();

  const heldIntent = await readPendingStartIntent();

  expect(heldIntent).toBeUndefined();
});

test('it stops the minted row back when a stop lands while the start is in flight', async () => {
  const viewer = await createViewer();

  const source = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    status: 'stopped',
  });

  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ client, submitter });

  await writePendingStartIntent({
    activityID: source.id,
    avatarID: viewer.avatar.id,
    scopeID: source.scopeID,
    scopeType: source.scopeType,
  });

  const entryEpoch = context.getStopEpoch();

  // the stop lands while the start call is in flight: the deviation mints the row exactly as the
  // real service would, then advances the epoch as a concurrent stop does
  server.use(
    mockActivityService.startActivity.handler(async () => {
      const minted = await db.activityCollection.create({
        avatarID: viewer.avatar.id,
        scopeID: source.scopeID,
        scopeType: source.scopeType,
        status: 'active',
      });

      context.advanceStopEpoch();

      return minted;
    }),
  );

  const result = await flushPendingStart(context, entryEpoch, viewer.avatar.id);

  expect(result).toStrictEqual({ outcome: 'stopped' });

  const heldIntent = await readPendingStartIntent();

  expect(heldIntent).toBeUndefined();

  const minted = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: viewer.avatar.id, scopeID: source.scopeID }),
  );

  invariant(minted !== undefined, 'expected the minted row to survive');

  expect(minted.status).toBe('stopped');

  const heldStop = await readPendingStopIntent();

  expect(heldStop).toBeUndefined();
});
