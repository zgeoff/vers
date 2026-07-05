import type { Context, SecureAction } from '../types';
import { pendingTransactionCache } from './pending-transaction-cache';

interface Data {
  action: SecureAction;
  sessionID: null | string;
  target: string;
}

/**
 * Creates a pending transaction and stores it in the transaction cache,
 * returning the transaction ID.
 *
 * @returns The pending transaction's ID.
 */
export function createPendingTransaction(data: Data, ctx: Context): string {
  if (pendingTransactionCache.has(ctx.requestID)) {
    throw new Error('Only one pending transaction is allowed per request');
  }

  pendingTransactionCache.set(ctx.requestID, {
    ...data,
    attempts: 0,
    ipAddress: ctx.ipAddress,
  });

  return ctx.requestID;
}
