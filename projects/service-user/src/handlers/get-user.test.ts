import { expect, test } from 'bun:test';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import type { UserContract } from '@vers/contract-user';
import { createAnonymousViewer, createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import { createUserService } from '../create-user-service';

async function setupTest() {
  const db = await createTestDB();
  const { app } = await createUserService({ db: db.db });

  return { app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it gets a user by id', async () => {
  await using ctx = await setupTest();
  const { user } = await createTestUser(ctx.db);
  const { token } = await createAnonymousViewer({ audience: 'service-user' });
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  const result = await client.getUser({ id: user.id });

  expect(result).toStrictEqual({
    createdAt: user.createdAt,
    email: user.email,
    id: user.id,
    name: user.name,
    seed: user.seed,
    updatedAt: user.updatedAt,
    username: user.username,
  });
});

test('it gets a user by email', async () => {
  await using ctx = await setupTest();
  const { user } = await createTestUser(ctx.db);
  const { token } = await createAnonymousViewer({ audience: 'service-user' });
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  const result = await client.getUser({ email: user.email });

  expect(result?.id).toBe(user.id);
});

test('it returns null for a non-existent user', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-user' });
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  const result = await client.getUser({ id: 'non-existent-id' });

  expect(result).toBeNull();
});

test('it returns null when neither id nor email is provided', async () => {
  await using ctx = await setupTest();
  await createTestUser(ctx.db);

  const { token } = await createAnonymousViewer({ audience: 'service-user' });
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  const result = await client.getUser({});

  expect(result).toBeNull();
});
