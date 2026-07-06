import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createVerificationRow } from './create-verification-row';

test('it inserts a verification row with faker-generated defaults', async () => {
  await using testDB = await createTestDB();

  const verification = await createVerificationRow(testDB.db);

  const row = await testDB.db
    .selectFrom('verifications')
    .selectAll()
    .where('id', '=', verification.id)
    .executeTakeFirstOrThrow();

  expect(row.type).toBe('onboarding');
});

test('it applies overrides on top of the faker-generated defaults', async () => {
  await using testDB = await createTestDB();

  const verification = await createVerificationRow(testDB.db, {
    target: 'foreign@example.com',
    type: '2fa',
  });

  expect(verification).toMatchObject({ target: 'foreign@example.com', type: '2fa' });
});
