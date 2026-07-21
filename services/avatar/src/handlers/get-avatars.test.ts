import { expect, test } from 'bun:test';
import type { AvatarContract } from '@vers/contract-avatar';
import { createAnonymousViewer, createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createAvatarService } from '../create-avatar-service';
import { createAvatarRow } from '../test-utils/create-avatar-row';

async function setupTest() {
  const db = await createTestDB();
  const service = await createAvatarService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it lists only the acting user avatars', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  await client.createAvatar({ name: 'OwnerAvatarOne' });
  await client.createAvatar({ name: 'OwnerAvatarTwo' });

  const roster = await client.getAvatars({});

  expect(roster.avatars.map((avatar) => avatar.name)).toIncludeSameMembers([
    'OwnerAvatarOne',
    'OwnerAvatarTwo',
  ]);
});

test('it excludes avatars owned by another user', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });
  const other = await createViewer({ audience: 'service-avatar', db: ctx.db });

  await createAvatarRow(ctx.db, { name: 'NotYours', userId: other.user.id });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  const roster = await client.getAvatars({});

  expect(roster).toStrictEqual({ activeAvatarID: null, avatars: [] });
});

test('it answers null active selection when avatars exist but none is selected', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  const avatar = await client.createAvatar({ name: 'Lingering' });

  await ctx.db.deleteFrom('activeAvatars').where('userId', '=', viewer.user.id).execute();

  const roster = await client.getAvatars({});

  expect(roster.avatars.map((entry) => entry.id)).toEqual([avatar.id]);
  expect(roster.activeAvatarID).toBeNull();
});

test('it drops the active selection when the active avatar is deleted', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  const avatar = await client.createAvatar({ name: 'Ephemeral' });

  await client.deleteAvatar({ id: avatar.id });

  const roster = await client.getAvatars({});

  expect(roster.activeAvatarID).toBeNull();
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-avatar' });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  expect(client.getAvatars({})).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});
