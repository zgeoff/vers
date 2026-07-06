import type { DB, PendingTransactions } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { createMockPendingTransaction } from './factories/create-mock-pending-transaction';

/**
 * Inserts a pending-transaction row via kysely — needed to seed transactions this package's tests
 * consume or expire directly, bypassing the create/consume RPCs under test.
 */
export function createPendingTransactionRow(
  db: Kysely<DB>,
  overrides: Partial<Insertable<PendingTransactions>> = {},
): Promise<Selectable<PendingTransactions>> {
  const row = createMockPendingTransaction(overrides);

  return db.insertInto('pendingTransactions').values(row).returningAll().executeTakeFirstOrThrow();
}
