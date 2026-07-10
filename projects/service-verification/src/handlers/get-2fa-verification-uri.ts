import { getTOTPAuthUri } from '@epic-web/totp';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload } from '../types';

/**
 * oRPC handler opts for the `get2FAVerificationURI` procedure.
 */
interface Get2FAVerificationURIOpts {
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
  };
  readonly input: { readonly target: string };
}

/**
 * Returns the TOTP auth URI for a target's pending 2FA setup; throws NOT_FOUND when none exists.
 */
export async function get2FAVerificationURI(
  db: Kysely<DB>,
  opts: Get2FAVerificationURIOpts,
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
