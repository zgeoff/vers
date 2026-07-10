import type { PendingTransactionData, SecureAction } from '@vers/contract-session';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload } from '../types';
import { toPendingTransactionData } from './to-pending-transaction-data';

/**
 * Payload shape for the `TRANSACTION_MISMATCH` error, naming the first field that didn't match.
 */
interface TransactionMismatchPayload {
  readonly data: { readonly field: 'action' | 'ipAddress' | 'sessionID' | 'target' };
}

/**
 * oRPC handler opts for the public `stepUp.consumePendingTransaction` procedure.
 */
interface ConsumePendingTransactionOpts {
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly TRANSACTION_MISMATCH: (payload: TransactionMismatchPayload) => Error;
  };
  readonly input: {
    readonly action: SecureAction;
    readonly id: string;
    readonly ipAddress: string;
    readonly sessionID: null | string;
    readonly target: string;
  };
}

/**
 * Atomically consumes a pending step-up transaction: the DELETE...RETURNING is the single
 * statement that both claims and reads the row, so a second consume of the same id always finds
 * it already gone (#148). The consuming request's fields are matched against the deleted row only
 * after the delete — a mismatch still burns the transaction, by design, rather than leaving a
 * transaction alive for a second, better-matched attempt.
 */
export async function consumePendingTransaction(
  db: Kysely<DB>,
  opts: ConsumePendingTransactionOpts,
): Promise<PendingTransactionData> {
  const row = await db
    .deleteFrom('pendingTransactions')
    .where('id', '=', opts.input.id)
    .where('expiresAt', '>', new Date())
    .returningAll()
    .executeTakeFirst();

  if (row === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  if (row.action !== opts.input.action) {
    throw opts.errors.TRANSACTION_MISMATCH({ data: { field: 'action' } });
  }

  if (row.target !== opts.input.target) {
    throw opts.errors.TRANSACTION_MISMATCH({ data: { field: 'target' } });
  }

  if (row.ipAddress !== opts.input.ipAddress) {
    throw opts.errors.TRANSACTION_MISMATCH({ data: { field: 'ipAddress' } });
  }

  if (row.sessionId !== opts.input.sessionID) {
    throw opts.errors.TRANSACTION_MISMATCH({ data: { field: 'sessionID' } });
  }

  return toPendingTransactionData(row);
}
