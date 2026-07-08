import { os } from '../os';
import { findLivePendingTransaction } from './find-live-pending-transaction';

export const getPendingTransaction = os.stepUp.getPendingTransaction.handler(
  (opts) => findLivePendingTransaction(opts.input.id) ?? null,
);
