import type { PendingTransactionData } from '@vers/contract-session';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { toPendingTransactionData } from './to-pending-transaction-data';

/**
 * oRPC handler opts for the public `stepUp.getPendingTransaction` procedure.
 */
interface GetPendingTransactionOpts {
  readonly input: { readonly id: string };
}

/**
 * Reads a pending step-up transaction without consuming it; an expired row is lazy-deleted and
 * reported as missing. Never touches `attempts` — only `recordFailedAttempt` does.
 */
export async function getPendingTransaction(
  db: Kysely<DB>,
  opts: GetPendingTransactionOpts,
): Promise<PendingTransactionData | null> {
  const row = await db
    .selectFrom('pendingTransactions')
    .selectAll()
    .where('id', '=', opts.input.id)
    .executeTakeFirst();

  if (row === undefined) {
    return null;
  }

  if (row.expiresAt <= new Date()) {
    await db.deleteFrom('pendingTransactions').where('id', '=', row.id).execute();

    return null;
  }

  return toPendingTransactionData(row);
}
