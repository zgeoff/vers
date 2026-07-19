import * as db from '../../db';
import { os } from '../os';
import { findLivePendingTransaction } from './find-live-pending-transaction';

/**
 * Failed verify attempts a pending transaction tolerates before it's abandoned.
 */
const MAX_STEP_UP_ATTEMPTS = 5;

/**
 * Records one failed step-up code check. A pending transaction that runs out of attempts is
 * deleted outright, so a caller who can no longer finish it hits NOT_FOUND on a further consume —
 * the caller must restart the step-up flow instead of retrying the same transaction.
 */
export const recordFailedAttempt = os.stepUp.recordFailedAttempt.handler(async (opts) => {
  const row = findLivePendingTransaction(opts.input.id);

  if (row === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const attempts = row.attempts + 1;
  const attemptsRemaining = Math.max(0, MAX_STEP_UP_ATTEMPTS - attempts);

  if (attemptsRemaining === 0) {
    db.pendingTransactionCollection.delete(row);
  } else {
    await db.pendingTransactionCollection.update(row, {
      data(record) {
        record.attempts = attempts;
      },
    });
  }

  return { attemptsRemaining };
});
