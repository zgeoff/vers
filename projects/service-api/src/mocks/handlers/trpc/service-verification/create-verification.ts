import { generateTOTP } from '@epic-web/totp';
import type { CreateVerificationPayload, VerificationType } from '@vers/service-types';
import { db } from '../../../db';
import { trpc } from './trpc';

// alphanumeric excluding 0, O, and I to avoid confusion
const TOTP_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789';

export const createVerification = trpc.createVerification.mutation(async (opts) => {
  // Delete any existing verification for this target and type
  db.verification.deleteMany({
    where: {
      target: { equals: opts.input.target },
      type: { equals: opts.input.type },
    },
  });

  const { otp, ...verificationConfig } = await generateTOTP({
    algorithm: 'SHA-256',
    charSet: TOTP_CHARSET,
    period: opts.input.period ?? 300, // default to 5 minutes if not specified
  });

  const verification = db.verification.create({
    expiresAt: opts.input.expiresAt ? new Date(opts.input.expiresAt) : null,
    target: opts.input.target,
    type: opts.input.type,
    ...verificationConfig,
  });

  const result: CreateVerificationPayload = {
    id: verification.id,
    otp,
    target: verification.target,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- baseline(#236)
    type: verification.type as VerificationType,
  };

  return result;
});
