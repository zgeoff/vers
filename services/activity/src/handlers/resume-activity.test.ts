import { expect, test } from 'bun:test';
import { createContentVersion } from '@vers/content-registry';
import type { ActivityContract } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import {
  createActivityChainRow,
  createActivityRow,
  createAvatarRow,
  createServiceToken,
  createTestDB,
  createViewer,
  getTestServiceKeyPair,
} from '@vers/service-test-utils/bun';
import { createSimVersionRow } from '@vers/sim-registry/test-utils';
import { buildRPCTestClient } from '@vers/test-utils';
import { createActivityService } from '../create-activity-service';

/**
 * Several tests here drive advanceActivity, stopActivity, or trackActivityProgress, whose own
 * `db.transaction()` can't nest under the default rollback-on-dispose isolation — this suite runs
 * against a real, committed schema clone instead.
 */
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });

  await createSimVersionRow(db.db);
  await createContentVersion(db.db, createMockContentDocument({ contentVersion: '2' }));

  const service = await createActivityService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it stamps the acting session as the writer', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({
    audience: 'service-activity',
    db: ctx.db,
    sessionID: 'session-a',
  });

  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
    writerSessionId: 'session-a',
  });

  const keyPair = await getTestServiceKeyPair();

  const tokenB = await createServiceToken({
    actingSessionId: 'session-b',
    actingUserId: viewer.user.id,
    audience: 'service-activity',
    privateKey: keyPair.privateKey,
  });

  const clientB = buildRPCTestClient<ActivityContract>(ctx.app, { token: tokenB });

  const resumed = await clientB.resumeActivity({ activityID: started.id });

  expect(resumed).toMatchObject({ id: started.id, status: 'active' });

  const row = await ctx.db
    .selectFrom('activities')
    .select('writerSessionId')
    .where('id', '=', started.id)
    .executeTakeFirstOrThrow();

  expect(row.writerSessionId).toBe('session-b');
});

test('it reports NOT_FOUND for a stopped activity', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({
    audience: 'service-activity',
    db: ctx.db,
    sessionID: 'session-a',
  });

  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  await client.stopActivity({ avatarID: avatar.id });

  expect(client.resumeActivity({ activityID: started.id })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

test("it reports NOT_FOUND for another user's activity", async () => {
  await using ctx = await setupTest();

  const owner = await createViewer({
    audience: 'service-activity',
    db: ctx.db,
    sessionID: 'session-a',
  });

  const avatar = await createAvatarRow(ctx.db, { userId: owner.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  const intruder = await createViewer({
    audience: 'service-activity',
    db: ctx.db,
    sessionID: 'session-b',
  });

  const intruderClient = buildRPCTestClient<ActivityContract>(ctx.app, { token: intruder.token });

  expect(intruderClient.resumeActivity({ activityID: started.id })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

test('it rejects a session-less caller with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  await createActivityChainRow(ctx.db, { avatarId: avatar.id, scopeId: '0_0' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    scopeId: '0_0',
  });

  expect(client.resumeActivity({ activityID: started.id })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
  });
});
