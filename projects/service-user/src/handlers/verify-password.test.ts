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

test('it verifies a correct password', async () => {
  await using ctx = await setupTest();
  const { user } = await createTestUser(ctx.db, { password: 'password123' });
  const { token } = await createAnonymousViewer({ audience: 'service-user' });
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  const result = await client.verifyPassword({ email: user.email, password: 'password123' });

  expect(result).toStrictEqual({ success: true });
});

test('it returns success=false for an incorrect password', async () => {
  await using ctx = await setupTest();
  const { user } = await createTestUser(ctx.db, { password: 'password123' });
  const { token } = await createAnonymousViewer({ audience: 'service-user' });
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  const result = await client.verifyPassword({ email: user.email, password: 'wrongpassword' });

  expect(result).toStrictEqual({ success: false });
});

test('it returns success=false for an unknown email without revealing user existence', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-user' });
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  const result = await client.verifyPassword({
    email: 'nonexistent@test.com',
    password: 'password123',
  });

  expect(result).toStrictEqual({ success: false });
});

test('it returns success=false for a user without a password set', async () => {
  await using ctx = await setupTest();
  const { user } = await createTestUser(ctx.db, { password: null });
  const { token } = await createAnonymousViewer({ audience: 'service-user' });
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  const result = await client.verifyPassword({ email: user.email, password: 'password123' });

  expect(result).toStrictEqual({ success: false });
});

test('it verifies a legacy bcrypt hash and rehashes it as argon2id on success', async () => {
  await using ctx = await setupTest();

  const { user } = await createTestUser(ctx.db, {
    password: 'password123',
    passwordAlgorithm: 'bcrypt',
  });

  const { token } = await createAnonymousViewer({ audience: 'service-user' });
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  const result = await client.verifyPassword({ email: user.email, password: 'password123' });

  expect(result).toStrictEqual({ success: true });

  const row = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', user.id)
    .executeTakeFirstOrThrow();

  expect(row.passwordHash).toStartWith('$argon2');
});

test('it leaves a legacy bcrypt hash untouched on a failed attempt', async () => {
  await using ctx = await setupTest();

  const { user } = await createTestUser(ctx.db, {
    password: 'password123',
    passwordAlgorithm: 'bcrypt',
  });

  const { token } = await createAnonymousViewer({ audience: 'service-user' });
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  const result = await client.verifyPassword({ email: user.email, password: 'wrongpassword' });

  expect(result).toStrictEqual({ success: false });

  const row = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', user.id)
    .executeTakeFirstOrThrow();

  expect(row.passwordHash).toBe(user.passwordHash);
});
