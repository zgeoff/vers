import { generateTOTP } from '@epic-web/totp';
import { createId } from '@paralleldrive/cuid2';
import type { VerificationData, VerificationType } from '@vers/contract-verification';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { toVerificationData } from './to-verification-data';

// alphanumeric excluding 0, O, and I on purpose to avoid confusing users
const TOTP_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789';

// standard charset used by 2FA apps
const TWO_FACTOR_CHARSET = '0123456789';

const VERIFICATION_TYPE_TO_CHARSET: Record<VerificationType, string> = {
  '2fa': TWO_FACTOR_CHARSET,
  '2fa-setup': TWO_FACTOR_CHARSET,
  'change-email': TOTP_CHARSET,
  onboarding: TOTP_CHARSET,
};

/** oRPC handler opts for the `createVerification` procedure. */
interface CreateVerificationOpts {
  readonly input: {
    readonly expiresAt?: Date | null | undefined;
    readonly period?: number | undefined;
    readonly target: string;
    readonly type: VerificationType;
  };
}

/**
 * Creates a TOTP-backed verification code for a target, replacing any existing code of the same
 * type and target in one statement so a stale code can never be verified alongside a fresh one.
 */
export async function createVerification(
  db: Kysely<DB>,
  opts: CreateVerificationOpts,
): Promise<VerificationData & { otp: string }> {
  const { expiresAt, period, target, type } = opts.input;

  const { otp, ...totpConfig } = await generateTOTP({
    algorithm: 'SHA-256',
    charSet: VERIFICATION_TYPE_TO_CHARSET[type],
    ...(period !== undefined && { period }),
  });

  const row = await db
    .with('replaced', (qb) =>
      qb
        .deleteFrom('verifications')
        .where('target', '=', target)
        .where('type', '=', type)
        .returningAll(),
    )
    .insertInto('verifications')
    .values({ id: createId(), target, type, expiresAt: expiresAt ?? null, ...totpConfig })
    .returningAll()
    .executeTakeFirstOrThrow();

  return { ...toVerificationData(row), otp };
}
