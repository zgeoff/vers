import * as db from '../../../db';
import { os } from '../os';
import { findLivePendingTransaction } from './find-live-pending-transaction';

/**
 * Consumes a pending step-up transaction exactly once: every field the caller asserts must match
 * the row created for it, and a match deletes the row in the same call so a replayed consume
 * always lands on `NOT_FOUND` instead of succeeding twice.
 */
export const consumePendingTransaction = os.stepUp.consumePendingTransaction.handler((opts) => {
  const row = findLivePendingTransaction(opts.input.id);

  if (row === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  if (row.action !== opts.input.action) {
    throw opts.errors.TRANSACTION_MISMATCH({ data: { field: 'action' } });
  }

  if (row.ipAddress !== opts.input.ipAddress) {
    throw opts.errors.TRANSACTION_MISMATCH({ data: { field: 'ipAddress' } });
  }

  if (row.sessionID !== opts.input.sessionID) {
    throw opts.errors.TRANSACTION_MISMATCH({ data: { field: 'sessionID' } });
  }

  if (row.target !== opts.input.target) {
    throw opts.errors.TRANSACTION_MISMATCH({ data: { field: 'target' } });
  }

  db.pendingTransactionCollection.delete(row);

  return row;
});
