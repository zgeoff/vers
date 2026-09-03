import type { DB, PendingTransactions } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { createMockPendingTransaction } from './factories/create-mock-pending-transaction';

export function createPendingTransactionRow(
  db: Kysely<DB>,
  overrides: Partial<Insertable<PendingTransactions>> = {},
): Promise<Selectable<PendingTransactions>> {
  const row = createMockPendingTransaction(overrides);

  return db.insertInto('pendingTransactions').values(row).returningAll().executeTakeFirstOrThrow();
}
