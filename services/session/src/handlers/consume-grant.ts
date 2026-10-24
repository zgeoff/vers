import type { SecureAction } from '@vers/contract-session';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { buildGrantTokenHash } from '../build-grant-token-hash';
import { recordGrantRefused } from '../metrics/record-grant-refused';

interface ConsumeGrantOpts {
  readonly input: {
    readonly action: SecureAction;
    readonly sessionID: null | string;
    readonly target: string;
    readonly token: string;
  };
}

export async function consumeGrant(
  db: Kysely<DB>,
  opts: ConsumeGrantOpts,
): Promise<{ consumed: boolean }> {
  const row = await db
    .deleteFrom('stepUpGrants')
    .where('tokenHash', '=', buildGrantTokenHash(opts.input.token))
    .where('action', '=', opts.input.action)
    .where('target', '=', opts.input.target)
    .where('sessionId', 'is not distinct from', opts.input.sessionID)
    .where('expiresAt', '>', new Date())
    .returning('tokenHash')
    .executeTakeFirst();

  if (row === undefined) {
    recordGrantRefused();

    return { consumed: false };
  }

  return { consumed: true };
}
