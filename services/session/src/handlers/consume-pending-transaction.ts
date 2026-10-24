import { randomBytes } from 'node:crypto';
import type { SecureAction } from '@vers/contract-session';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { buildGrantTokenHash } from '../build-grant-token-hash';
import { STEP_UP_GRANT_TTL } from '../consts';
import type { EmptyErrorPayload } from '../types';

interface TransactionMismatchPayload {
  readonly data: { readonly field: 'action' | 'ipAddress' | 'sessionID' | 'target' };
}

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

export async function consumePendingTransaction(
  db: Kysely<DB>,
  opts: ConsumePendingTransactionOpts,
): Promise<{ token: string }> {
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

  await db.deleteFrom('stepUpGrants').where('expiresAt', '<=', new Date()).execute();

  const token = randomBytes(32).toString('base64url');

  await db
    .insertInto('stepUpGrants')
    .values({
      action: row.action,
      expiresAt: new Date(Date.now() + STEP_UP_GRANT_TTL),
      sessionId: row.sessionId,
      target: row.target,
      tokenHash: buildGrantTokenHash(token),
    })
    .execute();

  return { token };
}
