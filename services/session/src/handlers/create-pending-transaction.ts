import type { PendingTransactionData, SecureAction } from '@vers/contract-session';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { PENDING_TRANSACTION_TTL } from '../consts';
import type { EmptyErrorPayload } from '../types';
import { toPendingTransactionData } from './to-pending-transaction-data';

interface CreatePendingTransactionOpts {
  readonly errors: {
    readonly CONFLICT: (payload: EmptyErrorPayload) => Error;
  };
  readonly input: {
    readonly action: SecureAction;
    readonly id: string;
    readonly ipAddress: string;
    readonly sessionID: null | string;
    readonly target: string;
  };
}

export async function createPendingTransaction(
  db: Kysely<DB>,
  opts: CreatePendingTransactionOpts,
): Promise<PendingTransactionData> {
  await db.deleteFrom('pendingTransactions').where('expiresAt', '<=', new Date()).execute();

  try {
    const row = await db
      .insertInto('pendingTransactions')
      .values({
        action: opts.input.action,
        expiresAt: new Date(Date.now() + PENDING_TRANSACTION_TTL),
        id: opts.input.id,
        ipAddress: opts.input.ipAddress,
        sessionId: opts.input.sessionID,
        target: opts.input.target,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toPendingTransactionData(row);
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      throw opts.errors.CONFLICT({ data: {} });
    }

    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
