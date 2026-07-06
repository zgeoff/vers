import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { createTestDB } from './create-test-db';
import { createTestUser } from './create-test-user';

test('it inserts a user with faker-defaulted fields and an argon2id password hash', async () => {
  await using testDB = await createTestDB();

  const { user } = await createTestUser(testDB.db, { email: 'insert-proof@test.com' });

  const row = await testDB.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', user.id)
    .executeTakeFirstOrThrow();

  expect(row.email).toBe('insert-proof@test.com');
  expect(row.passwordHash).toStartWith('$argon2id$');
});

test('it hashes the password as legacy bcrypt when requested', async () => {
  await using testDB = await createTestDB();

  const { user } = await createTestUser(testDB.db, { passwordAlgorithm: 'bcrypt' });

  const row = await testDB.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', user.id)
    .executeTakeFirstOrThrow();

  expect(row.passwordHash).toStartWith('$2');
});

test('it leaves the password hash null when password is explicitly null', async () => {
  await using testDB = await createTestDB();

  const { user } = await createTestUser(testDB.db, { password: null });

  expect(user.passwordHash).toBeNull();
});

test('it hashes a reset token and echoes back the plaintext', async () => {
  await using testDB = await createTestDB();

  const { resetToken, user } = await createTestUser(testDB.db, { resetToken: 'plaintext-token' });

  expect(resetToken).toBe('plaintext-token');

  expect(user.passwordResetToken).toBe(
    createHash('sha256').update('plaintext-token').digest('hex'),
  );
});
