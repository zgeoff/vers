import { createId } from '@paralleldrive/cuid2';
import * as db from '../../db';
import { os } from '../os';
import { findLivePendingTransaction } from './find-live-pending-transaction';

const STEP_UP_GRANT_TTL_MS = 5 * 60 * 1000;

export const consumePendingTransaction = os.stepUp.consumePendingTransaction.handler(
  async (opts) => {
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

    const grant = await db.stepUpGrantCollection.create({
      action: row.action,
      expiresAt: new Date(Date.now() + STEP_UP_GRANT_TTL_MS),
      sessionID: row.sessionID,
      target: row.target,
      token: createId(),
    });

    return { token: grant.token };
  },
);
