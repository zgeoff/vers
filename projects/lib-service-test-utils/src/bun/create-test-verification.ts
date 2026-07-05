import { generateTOTP } from '@epic-web/totp';
import { createId } from '@paralleldrive/cuid2';
import type { DB, Verifications } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';

type TestVerificationData = Partial<Insertable<Verifications>>;

/**
 * Inserts a verification row for bun-test suites via kysely, generating a
 * real TOTP secret/config so `@epic-web/totp` can verify codes against it.
 */
export async function createTestVerification(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  db: Kysely<DB>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  data: TestVerificationData = {},
): Promise<Selectable<Verifications>> {
  const now = new Date();

  const { otp, ...verificationConfig } = await generateTOTP({
    algorithm: 'SHA-256',
    charSet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
  });

  const row = {
    createdAt: now,
    expiresAt: null,
    id: createId(),
    lastVerifiedAt: null,
    lastVerifiedCode: null,
    target: 'test@example.com',
    type: '2fa',
    ...verificationConfig,
    ...data,
  } satisfies Insertable<Verifications>;

  const verification = await db
    .insertInto('verifications')
    .values(row)
    .returningAll()
    .executeTakeFirstOrThrow();

  return verification;
}
