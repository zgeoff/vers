import { expect, test } from 'bun:test';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import type { UserContract } from '@vers/contract-user';
import { createAnonymousViewer, createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import { createUserService } from '../create-user-service';
import { createSessionRow } from '../test-utils/create-session-row';

async function setupTest() {
  const db = await createTestDB();
  const { app } = await createUserService({ db: db.db });

  return { app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it accepts the plaintext token whose hash is stored', async () => {
  await using ctx = await setupTest();
  const { user } = await createTestUser(ctx.db, { resetToken: 'plaintext-token' });
  const { token } = await createAnonymousViewer({ audience: 'service-user' });
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  const result = await client.resetPassword({
    id: user.id,
    password: 'newpassword123',
    resetToken: 'plaintext-token',
  });

  expect(result).toStrictEqual({});

  const row = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', user.id)
    .executeTakeFirstOrThrow();

  expect(row.passwordHash).toStartWith('$argon2id$');
  expect(row.passwordResetToken).toBeNull();
  expect(row.passwordResetTokenExpiresAt).toBeNull();
});

test("it deletes all of the user's sessions when the password is reset", async () => {
  await using ctx = await setupTest();
  const { user } = await createTestUser(ctx.db, { resetToken: 'plaintext-token' });

  await createSessionRow(ctx.db, { userId: user.id });
  await createSessionRow(ctx.db, { userId: user.id });

  const { token } = await createAnonymousViewer({ audience: 'service-user' });
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  await client.resetPassword({
    id: user.id,
    password: 'newpassword123',
    resetToken: 'plaintext-token',
  });

  const sessions = await ctx.db
    .selectFrom('sessions')
    .selectAll()
    .where('userId', '=', user.id)
    .execute();

  expect(sessions).toBeEmpty();
});

test('it rejects a password that fails the password policy', async () => {
  await using ctx = await setupTest();
  const { user } = await createTestUser(ctx.db, { resetToken: 'plaintext-token' });
  const { token } = await createAnonymousViewer({ audience: 'service-user' });
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  expect(
    client.resetPassword({
      id: user.id,
      password: 'short',
      resetToken: 'plaintext-token',
    }),
  ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
});

test('it throws NOT_FOUND when the user does not exist', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-user' });
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  expect(
    client.resetPassword({
      id: 'nonexistent-id',
      password: 'newpassword123',
      resetToken: 'some-token',
    }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('it rejects a wrong token with INVALID_RESET_TOKEN', async () => {
  await using ctx = await setupTest();
  const { user } = await createTestUser(ctx.db, { resetToken: 'plaintext-token' });
  const { token } = await createAnonymousViewer({ audience: 'service-user' });
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  expect(
    client.resetPassword({
      id: user.id,
      password: 'newpassword123',
      resetToken: 'wrong-token',
    }),
  ).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' });
});

test('it rejects a request when no reset token has been requested', async () => {
  await using ctx = await setupTest();
  const { user } = await createTestUser(ctx.db);
  const { token } = await createAnonymousViewer({ audience: 'service-user' });
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  expect(
    client.resetPassword({
      id: user.id,
      password: 'newpassword123',
      resetToken: 'any-token',
    }),
  ).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' });
});

test('it rejects an expired reset token with RESET_TOKEN_EXPIRED', async () => {
  await using ctx = await setupTest();

  const { user } = await createTestUser(ctx.db, {
    passwordResetTokenExpiresAt: new Date(Date.now() - 1000 * 60 * 10),
    resetToken: 'plaintext-token',
  });

  const { token } = await createAnonymousViewer({ audience: 'service-user' });
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  expect(
    client.resetPassword({
      id: user.id,
      password: 'newpassword123',
      resetToken: 'plaintext-token',
    }),
  ).rejects.toMatchObject({ code: 'RESET_TOKEN_EXPIRED' });
});
