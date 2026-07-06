import { expect, test } from 'bun:test';
import { avatarContract } from '@vers/contract-avatar';
import { buildRPCTestClient, collectConformanceCases } from '@vers/contract-base/test-utils';
import { createDB } from '@vers/db';
import { createService } from '@vers/service-runtime';
import { createServiceKeyPair, createServiceToken } from '@vers/service-runtime/test-utils';
import { createKyselyTestDB, createTestUser } from '@vers/service-test-utils/bun';
import * as z from 'zod';
import { buildAvatarRouter } from './build-router';

const { privateKey, publicKeyPEM } = await createServiceKeyPair();

process.env['SERVICE_AUTH_PUBLIC_KEY'] = publicKeyPEM;

const testDB = await createKyselyTestDB();

process.env['DATABASE_URL'] = testDB.databaseURL;

const { app } = await createService({
  buildRouter: (runtime) =>
    buildAvatarRouter({ db: createDB({ databaseURL: runtime.env.DATABASE_URL }) }),
  contract: avatarContract,
  envShape: { DATABASE_URL: z.string() },
  name: 'service-avatar',
});

/** Builds an RPC test client authenticated as `userId`, exercising the app's real wire protocol. */
async function authedClientFor(userId: string) {
  const token = await createServiceToken({
    actingUserId: userId,
    audience: 'service-avatar',
    privateKey,
  });

  return buildRPCTestClient<typeof avatarContract>(app, {
    headers: { authorization: `Bearer ${token}` },
  });
}

/** Runs an RPC call expected to reject, returning the thrown error for shape assertions. */
async function runRejectingCall(call: () => Promise<unknown>): Promise<unknown> {
  try {
    await call();
  } catch (error) {
    return error;
  }

  throw new Error('expected the call to reject');
}

test('it creates an avatar owned by the acting user', async () => {
  const { user } = await createTestUser(testDB.db, {
    email: 'creates-owner@test.com',
    username: 'creates_owner',
  });

  const client = await authedClientFor(user.id);

  const avatar = await client.createAvatar({ class: 'brute', name: 'Brutus' });

  expect(avatar).toStrictEqual({
    class: 'brute',
    createdAt: expect.toBeValidDate(),
    id: expect.toBeString(),
    level: 1,
    name: 'Brutus',
    updatedAt: expect.toBeValidDate(),
    userID: user.id,
    xp: 0,
  });

  const row = await testDB.db
    .selectFrom('avatars')
    .selectAll()
    .where('id', '=', avatar.id)
    .executeTakeFirstOrThrow();

  expect(row.userId).toBe(user.id);
});

test('it rejects a second avatar with a duplicate name with CONFLICT', async () => {
  const { user } = await createTestUser(testDB.db, {
    email: 'duplicate-owner@test.com',
    username: 'duplicate_owner',
  });

  const client = await authedClientFor(user.id);

  await client.createAvatar({ class: 'scholar', name: 'Duplicatus' });

  const error = await runRejectingCall(() =>
    client.createAvatar({ class: 'scoundrel', name: 'Duplicatus' }),
  );

  expect(error).toMatchObject({ code: 'CONFLICT' });
});

test('it lists only the acting user avatars', async () => {
  const { user: owner } = await createTestUser(testDB.db, {
    email: 'list-owner@test.com',
    username: 'list_owner',
  });

  const { user: other } = await createTestUser(testDB.db, {
    email: 'list-other@test.com',
    username: 'list_other',
  });

  const ownerClient = await authedClientFor(owner.id);
  const otherClient = await authedClientFor(other.id);

  await ownerClient.createAvatar({ class: 'brute', name: 'OwnerAvatarOne' });
  await ownerClient.createAvatar({ class: 'scholar', name: 'OwnerAvatarTwo' });
  await otherClient.createAvatar({ class: 'scoundrel', name: 'OtherAvatarOne' });

  const avatars = await ownerClient.getAvatars({});

  expect(avatars).toHaveLength(2);

  expect(avatars.map((avatar) => avatar.name)).toIncludeSameMembers([
    'OwnerAvatarOne',
    'OwnerAvatarTwo',
  ]);
});

test('it returns an owned avatar by id', async () => {
  const { user } = await createTestUser(testDB.db, {
    email: 'findable-owner@test.com',
    username: 'findable_owner',
  });

  const client = await authedClientFor(user.id);

  const created = await client.createAvatar({ class: 'brute', name: 'Findable' });
  const found = await client.getAvatar({ id: created.id });

  expect(found).toStrictEqual(created);
});

test('it returns null for an id owned by another user', async () => {
  const { user: owner } = await createTestUser(testDB.db, {
    email: 'hidden-owner@test.com',
    username: 'hidden_owner',
  });

  const { user: other } = await createTestUser(testDB.db, {
    email: 'hidden-other@test.com',
    username: 'hidden_other',
  });

  const ownerClient = await authedClientFor(owner.id);
  const otherClient = await authedClientFor(other.id);

  const created = await ownerClient.createAvatar({ class: 'brute', name: 'NotYours' });
  const found = await otherClient.getAvatar({ id: created.id });

  expect(found).toBeNull();
});

test('it updates the name of an owned avatar and reports the updated id', async () => {
  const { user } = await createTestUser(testDB.db, {
    email: 'renames-owner@test.com',
    username: 'renames_owner',
  });

  const client = await authedClientFor(user.id);

  const created = await client.createAvatar({ class: 'brute', name: 'Renameable' });
  const result = await client.updateAvatar({ id: created.id, name: 'Renamed' });

  expect(result).toStrictEqual({ updatedID: created.id });

  const row = await testDB.db
    .selectFrom('avatars')
    .selectAll()
    .where('id', '=', created.id)
    .executeTakeFirstOrThrow();

  expect(row.name).toBe('Renamed');
});

test('it returns NOT_FOUND updating an avatar the caller does not own', async () => {
  const { user: owner } = await createTestUser(testDB.db, {
    email: 'updateguard-owner@test.com',
    username: 'updateguard_owner',
  });

  const { user: other } = await createTestUser(testDB.db, {
    email: 'updateguard-other@test.com',
    username: 'updateguard_other',
  });

  const ownerClient = await authedClientFor(owner.id);
  const otherClient = await authedClientFor(other.id);

  const created = await ownerClient.createAvatar({ class: 'brute', name: 'Unrenameable' });

  const error = await runRejectingCall(() =>
    otherClient.updateAvatar({ id: created.id, name: 'Hijacked' }),
  );

  expect(error).toMatchObject({ code: 'NOT_FOUND' });
});

test('it deletes an owned avatar and reports the deleted id', async () => {
  const { user } = await createTestUser(testDB.db, {
    email: 'removes-owner@test.com',
    username: 'removes_owner',
  });

  const client = await authedClientFor(user.id);

  const created = await client.createAvatar({ class: 'brute', name: 'Removable' });
  const result = await client.deleteAvatar({ id: created.id });

  expect(result).toStrictEqual({ deletedID: created.id });

  const row = await testDB.db
    .selectFrom('avatars')
    .selectAll()
    .where('id', '=', created.id)
    .executeTakeFirst();

  expect(row).toBeUndefined();
});

test('it returns NOT_FOUND deleting an avatar the caller does not own', async () => {
  const { user: owner } = await createTestUser(testDB.db, {
    email: 'removeguard-owner@test.com',
    username: 'removeguard_owner',
  });

  const { user: other } = await createTestUser(testDB.db, {
    email: 'removeguard-other@test.com',
    username: 'removeguard_other',
  });

  const ownerClient = await authedClientFor(owner.id);
  const otherClient = await authedClientFor(other.id);

  const created = await ownerClient.createAvatar({ class: 'brute', name: 'Unremovable' });

  const error = await runRejectingCall(() => otherClient.deleteAvatar({ id: created.id }));

  expect(error).toMatchObject({ code: 'NOT_FOUND' });
});

test('it throws UNAUTHORIZED for an anonymous acting user', async () => {
  const anonymousToken = await createServiceToken({ audience: 'service-avatar', privateKey });

  const client = buildRPCTestClient<typeof avatarContract>(app, {
    headers: { authorization: `Bearer ${anonymousToken}` },
  });

  const error = await runRejectingCall(() => client.getAvatars({}));

  expect(error).toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});

test('it passes every conformance case collected from its contract', async () => {
  const anonymousToken = await createServiceToken({ audience: 'service-avatar', privateKey });

  const cases = collectConformanceCases(avatarContract, {
    anonymousHeaders: { authorization: `Bearer ${anonymousToken}` },
    authedSamples: {
      createAvatar: { class: 'brute', name: 'Conformance' },
      deleteAvatar: { id: 'x' },
      getAvatar: { id: 'x' },
      getAvatars: {},
      updateAvatar: { id: 'x', name: 'ConformanceTwo' },
    },
  });

  for (const conformanceCase of cases) {
    await expect(conformanceCase.run(app)).toResolve();
  }
});
