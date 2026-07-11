import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createPendingTransactionRow } from './create-pending-transaction-row';

test('it inserts a pending-transaction row', async () => {
  await using testDB = await createTestDB();

  const transaction = await createPendingTransactionRow(testDB.db);

  const row = await testDB.db
    .selectFrom('pendingTransactions')
    .selectAll()
    .where('id', '=', transaction.id)
    .executeTakeFirstOrThrow();

  expect(row.action).toBe('TwoFactorAuth');
});

test('it applies overrides on top of the faker-generated defaults', async () => {
  await using testDB = await createTestDB();

  const transaction = await createPendingTransactionRow(testDB.db, {
    action: 'ChangePassword',
    target: 'override@example.com',
  });

  expect(transaction).toMatchObject({ action: 'ChangePassword', target: 'override@example.com' });
});
