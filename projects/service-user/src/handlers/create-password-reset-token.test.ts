import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import type { UserContract } from '@vers/contract-user';
import { createAnonymousViewer, createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import { createUserService } from '../create-user-service';

async function setupTest() {
  const db = await createTestDB();
  const { app } = await createUserService({ db: db.db });

  return { app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it creates a password reset token for an existing user', async () => {
  await using ctx = await setupTest();
  const { user } = await createTestUser(ctx.db);
  const { token } = await createAnonymousViewer({ audience: 'service-user' });
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  const result = await client.createPasswordResetToken({ id: user.id });

  expect(result).toStrictEqual({ resetToken: expect.toBeString() });

  const row = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', user.id)
    .executeTakeFirstOrThrow();

  expect(row.passwordResetTokenExpiresAt).toBeAfter(new Date());
  expect(row.passwordResetTokenExpiresAt).toBeBefore(new Date(Date.now() + 11 * 60 * 1000));
});

test('it stores only a hash of the reset token at rest', async () => {
  await using ctx = await setupTest();
  const { user } = await createTestUser(ctx.db);
  const { token } = await createAnonymousViewer({ audience: 'service-user' });
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  const result = await client.createPasswordResetToken({ id: user.id });

  const row = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', user.id)
    .executeTakeFirstOrThrow();

  expect(row.passwordResetToken).not.toBe(result.resetToken);
  expect(row.passwordResetToken).toBe(createHash('sha256').update(result.resetToken).digest('hex'));
});

test('it replaces the previous reset token when called again', async () => {
  await using ctx = await setupTest();
  const { user } = await createTestUser(ctx.db);
  const { token } = await createAnonymousViewer({ audience: 'service-user' });
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  const first = await client.createPasswordResetToken({ id: user.id });
  const second = await client.createPasswordResetToken({ id: user.id });

  expect(first.resetToken).not.toBe(second.resetToken);

  const row = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', user.id)
    .executeTakeFirstOrThrow();

  expect(row.passwordResetToken).toBe(createHash('sha256').update(second.resetToken).digest('hex'));
});

test('it throws NOT_FOUND when the user does not exist', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-user' });
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  expect(client.createPasswordResetToken({ id: 'nonexistent-id' })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

test('it throws NO_PASSWORD for a user without a password', async () => {
  await using ctx = await setupTest();
  const { user } = await createTestUser(ctx.db, { password: null });
  const { token } = await createAnonymousViewer({ audience: 'service-user' });
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  expect(client.createPasswordResetToken({ id: user.id })).rejects.toMatchObject({
    code: 'NO_PASSWORD',
  });
});
