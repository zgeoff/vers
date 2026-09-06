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

interface CodeLifetime {
  readonly expires: boolean;
  readonly periodSeconds: number;
}

const EMAILED_CODE_LIFETIME: CodeLifetime = { expires: true, periodSeconds: 600 };
const AUTHENTICATOR_CODE_LIFETIME: CodeLifetime = { expires: false, periodSeconds: 30 };

const VERIFICATION_TYPE_TO_LIFETIME: Record<VerificationType, CodeLifetime> = {
  '2fa': AUTHENTICATOR_CODE_LIFETIME,
  '2fa-setup': AUTHENTICATOR_CODE_LIFETIME,
  'change-email': EMAILED_CODE_LIFETIME,
  onboarding: EMAILED_CODE_LIFETIME,
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
  const lifetime = VERIFICATION_TYPE_TO_LIFETIME[opts.input.type];
  const period = opts.input.period ?? lifetime.periodSeconds;

  const expiresAt =
    opts.input.expiresAt === undefined ? pickDefaultExpiry(lifetime, period) : opts.input.expiresAt;

  const { otp, ...totpConfig } = await generateTOTP({
    algorithm: 'SHA-256',
    charSet: VERIFICATION_TYPE_TO_CHARSET[opts.input.type],
    period,
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

// verifyTOTP also accepts the periods either side of the current one, so the period alone keeps a
// code valid for one to two periods; the expiry caps an emailed code at exactly one period
function pickDefaultExpiry(lifetime: CodeLifetime, period: number): Date | null {
  return lifetime.expires ? new Date(Date.now() + period * 1000) : null;
}
