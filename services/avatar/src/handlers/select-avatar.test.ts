import { expect, test } from 'bun:test';
import type { AvatarContract } from '@vers/contract-avatar';
import {
  createActivityRow,
  createAnonymousViewer,
  createAvatarRow,
  createTestDB,
  createViewer,
} from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createAvatarService } from '../create-avatar-service';

async function setupTest() {
  const db = await createTestDB();
  const service = await createAvatarService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it persists the selected avatar as the active one', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  const first = await client.createAvatar({ name: 'FirstPick' });
  const second = await client.createAvatar({ name: 'SecondPick' });
  const selected = await client.selectAvatar({ id: first.id });

  expect(selected).toStrictEqual({ activeAvatarID: first.id });
  expect(second.id).not.toBe(first.id);

  const roster = await client.getAvatars({});

  expect(roster.activeAvatarID).toBe(first.id);
});

test('it rejects selecting an avatar owned by another user with NOT_FOUND', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });
  const other = await createViewer({ audience: 'service-avatar', db: ctx.db });
  const foreign = await createAvatarRow(ctx.db, { name: 'NotYours', userId: other.user.id });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  expect(client.selectAvatar({ id: foreign.id })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

test('it rejects switching away from an avatar with a live activity with CONFLICT', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  const runner = await client.createAvatar({ name: 'Runner' });
  const idle = await client.createAvatar({ name: 'Idler' });

  await createActivityRow(ctx.db, { avatarId: runner.id, status: 'active' });

  expect(client.selectAvatar({ id: idle.id })).rejects.toMatchObject({
    code: 'CONFLICT',
    data: { owningAvatarID: runner.id, owningAvatarName: 'Runner' },
  });
});

test('it allows re-selecting the avatar that owns the live activity', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  const runner = await client.createAvatar({ name: 'Runner' });

  await client.createAvatar({ name: 'Idler' });

  await createActivityRow(ctx.db, { avatarId: runner.id, status: 'active' });

  const selected = await client.selectAvatar({ id: runner.id });

  expect(selected).toStrictEqual({ activeAvatarID: runner.id });
});

test('it ignores a finished activity when switching', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  const runner = await client.createAvatar({ name: 'Runner' });
  const idle = await client.createAvatar({ name: 'Idler' });

  await createActivityRow(ctx.db, { avatarId: runner.id, status: 'stopped' });

  const selected = await client.selectAvatar({ id: idle.id });

  expect(selected).toStrictEqual({ activeAvatarID: idle.id });
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-avatar' });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  expect(client.selectAvatar({ id: 'anything' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});
