import { consumeGrant } from './consume-grant';
import { consumePendingTransaction } from './consume-pending-transaction';
import { createPendingTransaction } from './create-pending-transaction';
import { getPendingTransaction } from './get-pending-transaction';
import { recordFailedAttempt } from './record-failed-attempt';

export const stepUpRouter = {
  consumeGrant,
  consumePendingTransaction,
  createPendingTransaction,
  getPendingTransaction,
  recordFailedAttempt,
};
