import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import type { UserContract } from '@vers/contract-user';
import { createAnonymousViewer, createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createUserService } from '../create-user-service';

async function setupTest() {
  const db = await createTestDB();
  const service = await createUserService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it creates a password reset token for an existing user', async () => {
  await using ctx = await setupTest();

  const created = await createTestUser(ctx.db);
  const viewer = await createAnonymousViewer({ audience: 'service-user' });

  const client = buildRPCTestClient<UserContract>(ctx.app, { token: viewer.token });

  const result = await client.createPasswordResetToken({ id: created.user.id });

  expect(result).toStrictEqual({ resetToken: expect.toBeString() });

  const row = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', created.user.id)
    .executeTakeFirstOrThrow();

  expect(row.passwordResetTokenExpiresAt).toBeAfter(new Date());
  expect(row.passwordResetTokenExpiresAt).toBeBefore(new Date(Date.now() + 11 * 60 * 1000));
});

test('it stores only a hash of the reset token at rest', async () => {
  await using ctx = await setupTest();

  const created = await createTestUser(ctx.db);
  const viewer = await createAnonymousViewer({ audience: 'service-user' });

  const client = buildRPCTestClient<UserContract>(ctx.app, { token: viewer.token });

  const result = await client.createPasswordResetToken({ id: created.user.id });

  const row = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', created.user.id)
    .executeTakeFirstOrThrow();

  expect(row.passwordResetToken).not.toBe(result.resetToken);
  expect(row.passwordResetToken).toBe(createHash('sha256').update(result.resetToken).digest('hex'));
});

test('it replaces the previous reset token when called again', async () => {
  await using ctx = await setupTest();

  const created = await createTestUser(ctx.db);
  const viewer = await createAnonymousViewer({ audience: 'service-user' });

  const client = buildRPCTestClient<UserContract>(ctx.app, { token: viewer.token });

  const first = await client.createPasswordResetToken({ id: created.user.id });
  const second = await client.createPasswordResetToken({ id: created.user.id });

  expect(first.resetToken).not.toBe(second.resetToken);

  const row = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', created.user.id)
    .executeTakeFirstOrThrow();

  expect(row.passwordResetToken).toBe(createHash('sha256').update(second.resetToken).digest('hex'));
});

test('it throws NOT_FOUND when the user does not exist', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-user' });

  const client = buildRPCTestClient<UserContract>(ctx.app, { token: viewer.token });

  expect(client.createPasswordResetToken({ id: 'nonexistent-id' })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

test('it throws PASSWORD_NOT_SET for a user without a password', async () => {
  await using ctx = await setupTest();

  const created = await createTestUser(ctx.db, { password: null });
  const viewer = await createAnonymousViewer({ audience: 'service-user' });

  const client = buildRPCTestClient<UserContract>(ctx.app, { token: viewer.token });

  expect(client.createPasswordResetToken({ id: created.user.id })).rejects.toMatchObject({
    code: 'PASSWORD_NOT_SET',
  });
});
