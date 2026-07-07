import { expect, test } from 'bun:test';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import type { UserContract } from '@vers/contract-user';
import {
  createAnonymousViewer,
  createTestDB,
  createTestVerification,
  createViewer,
} from '@vers/service-test-utils/bun';
import { createUserService } from '../create-user-service';

async function setupTest() {
  const db = await createTestDB();
  const service = await createUserService({ db: db.db });
  const app = service.app;

  return { app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it updates the acting user email', async () => {
  await using ctx = await setupTest();
  const viewer = await createViewer({ audience: 'service-user', db: ctx.db });
  const token = viewer.token;
  const user = viewer.user;
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  const result = await client.updateEmail({ email: 'updated@test.com' });

  expect(result).toStrictEqual({ updatedID: user.id });

  const row = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', user.id)
    .executeTakeFirstOrThrow();

  expect(row.email).toBe('updated@test.com');
});

test('it repoints an in-progress 2fa verification to the new email', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({
    audience: 'service-user',
    db: ctx.db,
    user: { email: 'current@test.com' },
  });

  const token = viewer.token;

  const verification = await createTestVerification(ctx.db, {
    target: 'current@test.com',
    type: '2fa',
  });

  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  await client.updateEmail({ email: 'updated@test.com' });

  const row = await ctx.db
    .selectFrom('verifications')
    .selectAll()
    .where('id', '=', verification.id)
    .executeTakeFirstOrThrow();

  expect(row.target).toBe('updated@test.com');
});

test('it repoints an in-progress 2fa-setup verification to the new email', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({
    audience: 'service-user',
    db: ctx.db,
    user: { email: 'current@test.com' },
  });

  const token = viewer.token;

  const verification = await createTestVerification(ctx.db, {
    target: 'current@test.com',
    type: '2fa-setup',
  });

  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  await client.updateEmail({ email: 'updated@test.com' });

  const row = await ctx.db
    .selectFrom('verifications')
    .selectAll()
    .where('id', '=', verification.id)
    .executeTakeFirstOrThrow();

  expect(row.target).toBe('updated@test.com');
});

test('it throws NOT_FOUND when the acting user no longer exists', async () => {
  await using ctx = await setupTest();
  const viewer = await createViewer({ audience: 'service-user', db: ctx.db });
  const token = viewer.token;
  const user = viewer.user;

  await ctx.db.deleteFrom('users').where('id', '=', user.id).execute();

  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  expect(client.updateEmail({ email: 'updated@test.com' })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

test('it throws CONFLICT with field email when the email is taken', async () => {
  await using ctx = await setupTest();

  await createViewer({
    audience: 'service-user',
    db: ctx.db,
    user: { email: 'taken@test.com' },
  });

  const viewer = await createViewer({ audience: 'service-user', db: ctx.db });
  const token = viewer.token;
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  expect(client.updateEmail({ email: 'taken@test.com' })).rejects.toMatchObject({
    code: 'CONFLICT',
    data: { field: 'email' },
  });
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-user' });
  const token = viewer.token;
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  expect(client.updateEmail({ email: 'anonymous@test.com' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});
