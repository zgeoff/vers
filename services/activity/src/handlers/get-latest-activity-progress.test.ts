import { expect, test } from 'bun:test';
import type { ActivityContract } from '@vers/contract-activity';
import type { Isolation } from '@vers/service-test-utils/bun';
import { createAnonymousViewer, createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createActivityService } from '../create-activity-service';
import { createAvatarRow } from '../test-utils/create-avatar-row';
import { createMockCheckpointBatch } from '../test-utils/factories/create-mock-checkpoint-batch';

async function setupTest(options: { readonly isolation?: Isolation } = {}) {
  const db = await createTestDB(options);
  const service = await createActivityService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it returns a fresh activity with a null anchor at verifiedHead 0', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({ avatarID: avatar.id, nodeID: 'node_1' });
  const progress = await client.getLatestActivityProgress({ avatarID: avatar.id });

  expect(progress).toStrictEqual({
    activity: started,
    anchor: null,
    appendedHead: 0,
    verifiedHead: 0,
  });
});

// schema isolation: this exercises trackActivityProgress, whose own db.transaction() can't
// nest under the default rollback-on-dispose isolation.
test('it returns the activity anchored to its verified checkpoint once verifiedHead advances', async () => {
  await using ctx = await setupTest({ isolation: 'schema' });

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const started = await client.startActivity({ avatarID: avatar.id, nodeID: 'node_1' });

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

  const started = await client.startActivity({ avatarID: avatar.id, nodeID: 'node_1' });

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
