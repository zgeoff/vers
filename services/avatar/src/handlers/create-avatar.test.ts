import { expect, test } from 'bun:test';
import type { AvatarContract } from '@vers/contract-avatar';
import { AVATAR_MODE_CAP } from '@vers/contract-avatar';
import { createAnonymousViewer, createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createAvatarService } from '../create-avatar-service';
import { createActivityRow } from '../test-utils/create-activity-row';

async function setupTest() {
  const db = await createTestDB();
  const service = await createAvatarService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it creates an avatar owned by the acting user, defaulted to trade mode', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  const avatar = await client.createAvatar({ name: 'Brutus' });

  expect(avatar).toStrictEqual({
    createdAt: expect.toBeValidDate(),
    id: expect.toBeString(),
    level: 1,
    mode: 'trade',
    name: 'Brutus',
    updatedAt: expect.toBeValidDate(),
    userID: viewer.user.id,
    xp: 0,
  });
});

test('it creates an avatar with an explicitly chosen self_found mode', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  const avatar = await client.createAvatar({ mode: 'self_found', name: 'Vagrant' });

  expect(avatar.mode).toBe('self_found');
});

test('it rejects a second avatar with a duplicate name with CONFLICT', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  await client.createAvatar({ name: 'Duplicatus' });

  expect(client.createAvatar({ name: 'Duplicatus' })).rejects.toMatchObject({
    code: 'CONFLICT',
  });
});

test('it makes the created avatar the active one', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  await client.createAvatar({ name: 'Elder' });

  const younger = await client.createAvatar({ name: 'Younger' });
  const roster = await client.getAvatars({});

  expect(roster.activeAvatarID).toBe(younger.id);
});

test('it leaves the selection alone when a live activity holds it', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  const runner = await client.createAvatar({ name: 'Runner' });

  await createActivityRow(ctx.db, { avatarId: runner.id, status: 'active' });

  await client.createAvatar({ name: 'Newcomer' });

  const roster = await client.getAvatars({});

  expect(roster.activeAvatarID).toBe(runner.id);
});

test('it rejects a create past the per-mode cap with LIMIT_REACHED', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  for (let index = 0; index < AVATAR_MODE_CAP; index += 1) {
    await client.createAvatar({ name: `TradeAvatar${String.fromCodePoint(65 + index)}` });
  }

  expect(client.createAvatar({ name: 'OneTooMany' })).rejects.toMatchObject({
    code: 'LIMIT_REACHED',
    data: { cap: AVATAR_MODE_CAP, mode: 'trade' },
  });
});

test('it counts the cap per mode, not per account', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-avatar', db: ctx.db });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  for (let index = 0; index < AVATAR_MODE_CAP; index += 1) {
    await client.createAvatar({ name: `TradeAvatar${String.fromCodePoint(65 + index)}` });
  }

  const selfFound = await client.createAvatar({ mode: 'self_found', name: 'StillRoom' });

  expect(selfFound.mode).toBe('self_found');
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-avatar' });

  const client = buildRPCTestClient<AvatarContract>(ctx.app, { token: viewer.token });

  expect(client.createAvatar({ name: 'Anonymous' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});
