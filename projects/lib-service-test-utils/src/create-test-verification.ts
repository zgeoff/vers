import { generateTOTP } from '@epic-web/totp';
import { createId } from '@paralleldrive/cuid2';
import * as schema from '@vers/postgres-schema';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

type TestVerificationData = Partial<typeof schema.verifications.$inferSelect>;

export async function createTestVerification(
  db: PostgresJsDatabase<typeof schema>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- TestVerificationData's fields are derived through drizzle's $inferSelect conditional column typing, which this rule's type walker can't prove readonly even wrapped in Readonly<>
  data: Readonly<TestVerificationData> = {},
): Promise<typeof schema.verifications.$inferSelect> {
  const now = new Date();

  const { otp, ...verificationConfig } = await generateTOTP({
    algorithm: 'SHA-256',
    charSet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
  });

  const verification = {
    createdAt: now,
    expiresAt: null,
    id: createId(),
    target: 'test@example.com',
    type: '2fa',
    ...verificationConfig,
    ...data,
  } satisfies typeof schema.verifications.$inferInsert;

  await db.insert(schema.verifications).values(verification);

  return verification;
}
