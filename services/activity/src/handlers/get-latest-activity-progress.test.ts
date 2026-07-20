import { expect, test } from 'bun:test';
import type { ActivityContract } from '@vers/contract-activity';
import {
  createAnonymousViewer,
  createServiceToken,
  createTestDB,
  createViewer,
  getTestServiceKeyPair,
} from '@vers/service-test-utils/bun';
import { createSimVersionRow } from '@vers/sim-registry/test-utils';
import { buildRPCTestClient } from '@vers/test-utils';
import { createActivityService } from '../create-activity-service';
import { createAvatarRow } from '../test-utils/create-avatar-row';
import { createMockCheckpointBatch } from '../test-utils/factories/create-mock-checkpoint-batch';

/**
 * Several tests here drive startActivity, stopActivity, or trackActivityProgress, whose own
 * `db.transaction()` can't nest under the default rollback-on-dispose isolation — this suite runs
 * against a real, committed schema clone instead.
 */
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });

  await createSimVersionRow(db.db);

  const service = await createActivityService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it returns a fresh activity with a null anchor at verifiedHead 0', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
  });

  const progress = await client.getLatestActivityProgress({ avatarID: avatar.id });

  expect(progress).toStrictEqual({
    activity: started,
    anchor: null,
    appendedHead: 0,
    failureAction: 'abort',
    isWriter: true,
    serverTime: expect.toBeValidDate(),
    verifiedHead: 0,
  });
});

test("it returns the avatar's persisted failure action", async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const avatar = await createAvatarRow(ctx.db, {
    failureAction: 'retry',
    userId: viewer.user.id,
  });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
  });

  const progress = await client.getLatestActivityProgress({ avatarID: avatar.id });

  expect(progress.failureAction).toBe('retry');
});

test('it returns the server clock beside the resume cursors', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
  });

  const progress = await client.getLatestActivityProgress({ avatarID: avatar.id });

  // The clock and the activity's own timestamps come from the same database session, so an
  // offline gap computed as their difference can't be skewed by the caller's clock.
  expect(progress.serverTime).toBeValidDate();
  expect(progress.serverTime.getTime()).toBeGreaterThanOrEqual(started.startedAt.getTime());
});

test('it returns the activity anchored to its verified checkpoint once verifiedHead advances', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
  });

  const batch = createMockCheckpointBatch({ startPrevHash: started.startHash, startVersion: 1 });

  await client.trackActivityProgress({
    activityID: started.id,
    checkpoints: batch,
    expectedHead: 0,
  });

  await ctx.db
    .updateTable('activities')
    .set({ verifiedAt: new Date(), verifiedHead: 1 })
    .where('id', '=', started.id)
    .execute();

  const progress = await client.getLatestActivityProgress({ avatarID: avatar.id });

  expect(progress.anchor).toMatchObject({
    hash: batch[0]?.hash,
    prevHash: started.startHash,
    version: 1,
  });

  expect(progress.verifiedHead).toBe(1);
});

test('it returns the newest activity regardless of status', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
  });

  await client.stopActivity({ avatarID: avatar.id });

  const progress = await client.getLatestActivityProgress({ avatarID: avatar.id });

  expect(progress.activity.id).toBe(started.id);
  expect(progress.activity.status).toBe('stopped');
});

test('it rejects when no activity exists at all with NOT_FOUND', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(client.getLatestActivityProgress({ avatarID: avatar.id })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-activity' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(client.getLatestActivityProgress({ avatarID: 'avatar_1' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});

test('it reports isWriter false to a session another writer displaced', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });
  const keyPair = await getTestServiceKeyPair();

  const tokenA = await createServiceToken({
    actingSessionId: 'session-a',
    actingUserId: viewer.user.id,
    audience: 'service-activity',
    privateKey: keyPair.privateKey,
  });

  const clientA = buildRPCTestClient<ActivityContract>(ctx.app, { token: tokenA });

  const started = await clientA.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
  });

  const tokenB = await createServiceToken({
    actingSessionId: 'session-b',
    actingUserId: viewer.user.id,
    audience: 'service-activity',
    privateKey: keyPair.privateKey,
  });

  const clientB = buildRPCTestClient<ActivityContract>(ctx.app, { token: tokenB });

  const progressB = await clientB.getLatestActivityProgress({ avatarID: avatar.id });

  expect(progressB.isWriter).toBeFalse();

  const progressA = await clientA.getLatestActivityProgress({ avatarID: avatar.id });

  expect(progressA.isWriter).toBeTrue();
  expect(progressB.activity.id).toBe(started.id);
});

test('it reports isWriter true for an unstamped stream whatever the session', async () => {
  await using ctx = await setupTest();

  // the session-less token leaves the started row's writer unstamped
  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const sessionlessClient = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  await sessionlessClient.startActivity({
    avatarID: avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
  });

  const keyPair = await getTestServiceKeyPair();

  const token = await createServiceToken({
    actingSessionId: 'session-a',
    actingUserId: viewer.user.id,
    audience: 'service-activity',
    privateKey: keyPair.privateKey,
  });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token });

  const progress = await client.getLatestActivityProgress({ avatarID: avatar.id });

  expect(progress.isWriter).toBeTrue();
});
