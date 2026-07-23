import { expect, test } from 'bun:test';
import type { ActivityContract } from '@vers/contract-activity';
import {
  createAnonymousViewer,
  createAvatarRow,
  createTestDB,
  createViewer,
} from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createActivityService } from '../create-activity-service';

async function setupTest() {
  const db = await createTestDB();
  const service = await createActivityService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it persists the failure action and returns it', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const result = await client.updateFailureAction({
    avatarID: avatar.id,
    failureAction: 'retry',
  });

  expect(result).toStrictEqual({ failureAction: 'retry' });

  const row = await ctx.db
    .selectFrom('avatars')
    .select('failureAction')
    .where('id', '=', avatar.id)
    .executeTakeFirstOrThrow();

  expect(row.failureAction).toBe('retry');
});

test('it rejects an avatar owned by a different user with NOT_FOUND', async () => {
  await using ctx = await setupTest();

  const owner = await createViewer({ audience: 'service-activity', db: ctx.db });
  const otherViewer = await createViewer({ audience: 'service-activity', db: ctx.db });
  const avatar = await createAvatarRow(ctx.db, { userId: owner.user.id });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: otherViewer.token });

  expect(
    client.updateFailureAction({ avatarID: avatar.id, failureAction: 'retry' }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('it rejects an unknown avatar with NOT_FOUND', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.updateFailureAction({ avatarID: 'avatar_unknown', failureAction: 'retry' }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-activity' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.updateFailureAction({ avatarID: 'avatar_1', failureAction: 'retry' }),
  ).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});
