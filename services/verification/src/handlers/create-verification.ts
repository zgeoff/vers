import { generateTOTP } from '@epic-web/totp';
import { createId } from '@paralleldrive/cuid2';
import type { VerificationData, VerificationType } from '@vers/contract-verification';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { toVerificationData } from './to-verification-data';

// no 0, O, or I: they read alike to a person typing the code
const TOTP_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789';
const TWO_FACTOR_CHARSET = '0123456789';

const VERIFICATION_TYPE_TO_CHARSET: Record<VerificationType, string> = {
  '2fa': TWO_FACTOR_CHARSET,
  '2fa-setup': TWO_FACTOR_CHARSET,
  'change-email': TOTP_CHARSET,
  onboarding: TOTP_CHARSET,
};

interface CreateVerificationOpts {
  readonly input: {
    readonly expiresAt?: Date | null | undefined;
    readonly period?: number | undefined;
    readonly target: string;
    readonly type: VerificationType;
  };
}

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
