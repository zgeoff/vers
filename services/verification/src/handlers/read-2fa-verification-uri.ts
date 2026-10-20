import { getTOTPAuthUri } from '@epic-web/totp';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload } from '../types';

interface Read2FAVerificationURIOpts {
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
  };
  readonly input: { readonly target: string };
}

export async function read2FAVerificationURI(
  db: Kysely<DB>,
  opts: Read2FAVerificationURIOpts,
): Promise<{ otpURI: string }> {
  const row = await db
    .selectFrom('verifications')
    .selectAll()
    .where('type', '=', '2fa-setup')
    .where('target', '=', opts.input.target)
    .executeTakeFirst();

  if (row === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const otpURI = getTOTPAuthUri({
    accountName: opts.input.target,
    algorithm: row.algorithm,
    digits: row.digits,
    issuer: 'vers',
    period: row.period,
    secret: row.secret,
  });

  return { otpURI };
}
