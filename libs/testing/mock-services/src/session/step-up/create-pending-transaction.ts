import * as db from '../../db';
import { os } from '../os';

/**
 * How long a pending step-up transaction stays consumable before it must be restarted.
 */
const PENDING_TRANSACTION_TTL_MS = 10 * 60 * 1000;

export const createPendingTransaction = os.stepUp.createPendingTransaction.handler((opts) => {
  const existing = db.pendingTransactionCollection.findFirst((q) => q.where({ id: opts.input.id }));

  if (existing !== undefined) {
    throw opts.errors.CONFLICT({ data: {} });
  }

  return db.pendingTransactionCollection.create({
    action: opts.input.action,
    attempts: 0,
    expiresAt: new Date(Date.now() + PENDING_TRANSACTION_TTL_MS),
    id: opts.input.id,
    ipAddress: opts.input.ipAddress,
    sessionID: opts.input.sessionID,
    target: opts.input.target,
  });
});
