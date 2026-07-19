import { generateTOTP } from '@epic-web/totp';
import { createId } from '@paralleldrive/cuid2';
import type { VerificationData, VerificationType } from '@vers/contract-verification';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { toVerificationData } from './to-verification-data';

/**
 * Alphanumeric excluding 0, O, and I to avoid confusing users.
 */
const TOTP_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789';

/**
 * The digit charset standard 2FA apps expect.
 */
const TWO_FACTOR_CHARSET = '0123456789';

const VERIFICATION_TYPE_TO_CHARSET: Record<VerificationType, string> = {
  '2fa': TWO_FACTOR_CHARSET,
  '2fa-setup': TWO_FACTOR_CHARSET,
  'change-email': TOTP_CHARSET,
  onboarding: TOTP_CHARSET,
};

/**
 * oRPC handler opts for the `createVerification` procedure.
 */
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
 * The `(target, type)` unique constraint makes this a single `INSERT ... ON CONFLICT`: a
 * concurrent create for the same pair serializes on the row instead of racing an insert against a
 * delete. The row's id stays stable across a replace — its identity is the target+type pair, not
 * the id — but the replay guard (`lastVerifiedCode`/`lastVerifiedAt`) always resets, since a
 * recreated verification must not inherit the previous code's replay window.
 */
export async function createVerification(
  db: Kysely<DB>,
  opts: CreateVerificationOpts,
): Promise<VerificationData & { otp: string }> {
  const expiresAt = opts.input.expiresAt ?? null;

  const { otp, ...totpConfig } = await generateTOTP({
    algorithm: 'SHA-256',
    charSet: VERIFICATION_TYPE_TO_CHARSET[opts.input.type],
    ...(opts.input.period !== undefined && { period: opts.input.period }),
  });

  const row = await db
    .insertInto('verifications')
    .values({
      id: createId(),
      target: opts.input.target,
      type: opts.input.type,
      expiresAt,
      ...totpConfig,
    })
    .onConflict((oc) =>
      oc.columns(['target', 'type']).doUpdateSet({
        algorithm: totpConfig.algorithm,
        charSet: totpConfig.charSet,
        createdAt: new Date(),
        digits: totpConfig.digits,
        expiresAt,
        lastVerifiedAt: null,
        lastVerifiedCode: null,
        period: totpConfig.period,
        secret: totpConfig.secret,
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow();

  return { ...toVerificationData(row), otp };
}
