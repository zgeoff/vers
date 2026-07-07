import { expect, test } from 'bun:test';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import type { UserContract } from '@vers/contract-user';
import { createAnonymousViewer, createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { createUserService } from '../create-user-service';

async function setupTest() {
  const db = await createTestDB();
  const service = await createUserService({ db: db.db });
  const app = service.app;

  return { app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it updates the acting user name and username', async () => {
  await using ctx = await setupTest();
  const viewer = await createViewer({ audience: 'service-user', db: ctx.db });
  const token = viewer.token;
  const user = viewer.user;
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  const result = await client.updateUser({ name: 'Updated Name', username: 'updated_username' });

  expect(result).toStrictEqual({ updatedID: user.id });

  const row = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', user.id)
    .executeTakeFirstOrThrow();

  expect(row.name).toBe('Updated Name');
  expect(row.username).toBe('updated_username');
});

test('it allows partial updating', async () => {
  await using ctx = await setupTest();
  const viewer = await createViewer({ audience: 'service-user', db: ctx.db });
  const token = viewer.token;
  const user = viewer.user;
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  const result = await client.updateUser({ name: 'Updated Name' });

  expect(result).toStrictEqual({ updatedID: user.id });

  const row = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', user.id)
    .executeTakeFirstOrThrow();

  expect(row.name).toBe('Updated Name');
  expect(row.username).toBe(user.username);
});

test('it leaves the record unchanged when no fields are provided', async () => {
  await using ctx = await setupTest();
  const viewer = await createViewer({ audience: 'service-user', db: ctx.db });
  const token = viewer.token;
  const user = viewer.user;
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  const result = await client.updateUser({});

  expect(result).toStrictEqual({ updatedID: user.id });

  const row = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', user.id)
    .executeTakeFirstOrThrow();

  expect(row.name).toBe(user.name);
  expect(row.username).toBe(user.username);
});

test('it throws NOT_FOUND when no fields are provided and the user does not exist', async () => {
  await using ctx = await setupTest();
  const viewer = await createViewer({ audience: 'service-user', db: ctx.db });
  const token = viewer.token;
  const user = viewer.user;

  await ctx.db.deleteFrom('users').where('id', '=', user.id).execute();

  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  expect(client.updateUser({})).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('it throws NOT_FOUND when the acting user no longer exists', async () => {
  await using ctx = await setupTest();
  const viewer = await createViewer({ audience: 'service-user', db: ctx.db });
  const token = viewer.token;
  const user = viewer.user;

  await ctx.db.deleteFrom('users').where('id', '=', user.id).execute();

  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  expect(client.updateUser({ name: 'Updated Name' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('it throws CONFLICT with field username when the username is taken', async () => {
  await using ctx = await setupTest();

  await createViewer({
    audience: 'service-user',
    db: ctx.db,
    user: { username: 'taken_username' },
  });

  const viewer = await createViewer({ audience: 'service-user', db: ctx.db });
  const token = viewer.token;
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  expect(client.updateUser({ username: 'taken_username' })).rejects.toMatchObject({
    code: 'CONFLICT',
    data: { field: 'username' },
  });
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-user' });
  const token = viewer.token;
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  expect(client.updateUser({ name: 'Anonymous' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});
