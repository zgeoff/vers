import * as db from '../../db';
import { os } from '../os';
import { findLivePendingTransaction } from './find-live-pending-transaction';

const MAX_STEP_UP_ATTEMPTS = 5;

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
