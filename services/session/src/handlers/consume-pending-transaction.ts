import { randomBytes } from 'node:crypto';
import type { SecureAction } from '@vers/contract-session';
import type { DB, PendingTransactions } from '@vers/db';
import type { Kysely, Selectable } from 'kysely';
import invariant from 'tiny-invariant';
import { buildGrantTokenHash } from '../build-grant-token-hash';
import { STEP_UP_GRANT_TTL } from '../consts';
import type { EmptyErrorPayload } from '../types';

type MismatchedField = 'action' | 'ipAddress' | 'sessionID' | 'target';

interface TransactionMismatchPayload {
  readonly data: { readonly field: MismatchedField };
}

interface ConsumePendingTransactionInput {
  readonly action: SecureAction;
  readonly id: string;
  readonly ipAddress: string;
  readonly sessionID: null | string;
  readonly target: string;
}

interface ConsumePendingTransactionOpts {
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly TRANSACTION_MISMATCH: (payload: TransactionMismatchPayload) => Error;
  };
  readonly input: ConsumePendingTransactionInput;
}

export async function consumePendingTransaction(
  db: Kysely<DB>,
  opts: ConsumePendingTransactionOpts,
): Promise<{ token: string }> {
  await db.deleteFrom('stepUpGrants').where('expiresAt', '<=', new Date()).execute();

  const token = randomBytes(32).toString('base64url');

  const issued = await db
    .with('consumed', (query) =>
      query
        .deleteFrom('pendingTransactions')
        .where('id', '=', opts.input.id)
        .where('expiresAt', '>', new Date())
        .where('action', '=', opts.input.action)
        .where('target', '=', opts.input.target)
        .where('ipAddress', '=', opts.input.ipAddress)
        .where('sessionId', 'is not distinct from', opts.input.sessionID)
        .returning(['action', 'sessionId', 'target']),
    )
    .insertInto('stepUpGrants')
    .columns(['action', 'expiresAt', 'sessionId', 'target', 'tokenHash'])
    .expression((eb) =>
      eb
        .selectFrom('consumed')
        .select((select) => [
          'consumed.action',
          select.val(new Date(Date.now() + STEP_UP_GRANT_TTL)).as('expiresAt'),
          'consumed.sessionId',
          'consumed.target',
          select.val(buildGrantTokenHash(token)).as('tokenHash'),
        ]),
    )
    .returning('tokenHash')
    .executeTakeFirst();

  if (issued !== undefined) {
    return { token };
  }

  const burned = await db
    .deleteFrom('pendingTransactions')
    .where('id', '=', opts.input.id)
    .where('expiresAt', '>', new Date())
    .returningAll()
    .executeTakeFirst();

  if (burned === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const field = findMismatchedField(burned, opts.input);

  invariant(field !== undefined, 'a pending transaction that matches every field issues a grant');
  throw opts.errors.TRANSACTION_MISMATCH({ data: { field } });
}

function findMismatchedField(
  row: Readonly<Selectable<PendingTransactions>>,
  input: ConsumePendingTransactionInput,
): MismatchedField | undefined {
  if (row.action !== input.action) {
    return 'action';
  }

  if (row.target !== input.target) {
    return 'target';
  }

  if (row.ipAddress !== input.ipAddress) {
    return 'ipAddress';
  }

  if (row.sessionId !== input.sessionID) {
    return 'sessionID';
  }

  return undefined;
}
