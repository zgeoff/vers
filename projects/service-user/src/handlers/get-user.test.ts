import { expect, test } from 'bun:test';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import type { UserContract } from '@vers/contract-user';
import { createAnonymousViewer, createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import { createUserService } from '../create-user-service';

async function setupTest() {
  const db = await createTestDB();
  const service = await createUserService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it gets a user by id', async () => {
  await using ctx = await setupTest();

  const created = await createTestUser(ctx.db);
  const viewer = await createAnonymousViewer({ audience: 'service-user' });

  const client = buildRPCTestClient<UserContract>(ctx.app, { token: viewer.token });

  const result = await client.getUser({ id: created.user.id });

  expect(result).toStrictEqual({
    createdAt: created.user.createdAt,
    email: created.user.email,
    id: created.user.id,
    name: created.user.name,
    seed: created.user.seed,
    updatedAt: created.user.updatedAt,
    username: created.user.username,
  });
});

test('it gets a user by email', async () => {
  await using ctx = await setupTest();

  const created = await createTestUser(ctx.db);
  const viewer = await createAnonymousViewer({ audience: 'service-user' });

  const client = buildRPCTestClient<UserContract>(ctx.app, { token: viewer.token });

  const result = await client.getUser({ email: created.user.email });

  expect(result?.id).toBe(created.user.id);
});

test('it returns null for a non-existent user', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-user' });

  const client = buildRPCTestClient<UserContract>(ctx.app, { token: viewer.token });

  const result = await client.getUser({ id: 'non-existent-id' });

  expect(result).toBeNull();
});

test('it returns null when neither id nor email is provided', async () => {
  await using ctx = await setupTest();

  await createTestUser(ctx.db);

  const viewer = await createAnonymousViewer({ audience: 'service-user' });

  const client = buildRPCTestClient<UserContract>(ctx.app, { token: viewer.token });

  const result = await client.getUser({});

  expect(result).toBeNull();
});
