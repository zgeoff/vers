import { expect, test } from 'bun:test';
import type { UserContract } from '@vers/contract-user';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createUserService } from '../create-user-service';

async function setupTest() {
  const db = await createTestDB();
  const service = await createUserService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it creates a user with an argon2id-hashed password', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-user' });

  const client = buildRPCTestClient<UserContract>(ctx.app, { token: viewer.token });

  const result = await client.createUser({
    email: 'user@test.com',
    name: 'Test User',
    password: 'password123',
    username: 'test_user',
  });

  expect(result).toStrictEqual({
    createdAt: expect.toBeValidDate(),
    email: 'user@test.com',
    id: expect.toBeString(),
    name: 'Test User',
    seed: expect.toBeNumber(),
    updatedAt: expect.toBeValidDate(),
    username: 'test_user',
  });

  const row = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', result.id)
    .executeTakeFirstOrThrow();

  expect(row.passwordHash).toStartWith('$argon2id$');
});

// after this expected constraint violation, the shared transaction handle is aborted — no
// further queries run on ctx.db past the assertion
test('it throws CONFLICT with field email when a user with that email already exists', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-user' });

  const client = buildRPCTestClient<UserContract>(ctx.app, { token: viewer.token });

  await client.createUser({
    email: 'duplicate@test.com',
    name: 'Test User',
    password: 'password123',
    username: 'first_user',
  });

  expect(
    client.createUser({
      email: 'duplicate@test.com',
      name: 'Another User',
      password: 'password456',
      username: 'second_user',
    }),
  ).rejects.toMatchObject({
    code: 'CONFLICT',
    data: { field: 'email' },
  });
});

test('it throws CONFLICT with field username when a user with that username already exists', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-user' });

  const client = buildRPCTestClient<UserContract>(ctx.app, { token: viewer.token });

  await client.createUser({
    email: 'user1@test.com',
    name: 'Test User',
    password: 'password123',
    username: 'duplicate_user',
  });

  expect(
    client.createUser({
      email: 'user2@test.com',
      name: 'Another User',
      password: 'password456',
      username: 'duplicate_user',
    }),
  ).rejects.toMatchObject({
    code: 'CONFLICT',
    data: { field: 'username' },
  });
});
