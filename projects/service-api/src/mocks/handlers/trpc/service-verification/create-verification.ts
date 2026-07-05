import type {
  CreateVerificationPayload,
  VerificationType,
} from '@vers/service-types';
import { generateTOTP } from '@epic-web/totp';
import { db } from '../../../db';
import { trpc } from './trpc';

// alphanumeric excluding 0, O, and I to avoid confusion
const TOTP_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789';

export const createVerification = trpc.createVerification.mutation(
  async ({ input }) => {
    // Delete any existing verification for this target and type
    db.verification.deleteMany({
      where: {
        target: { equals: input.target },
        type: { equals: input.type },
      },
    });

    const { otp, ...verificationConfig } = await generateTOTP({
      algorithm: 'SHA-256',
      charSet: TOTP_CHARSET,
      period: input.period ?? 300, // default to 5 minutes if not specified
    });

    const verification = db.verification.create({
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      target: input.target,
      type: input.type,
      ...verificationConfig,
    });

    const result: CreateVerificationPayload = {
      id: verification.id,
      otp,
      target: verification.target,
      type: verification.type as VerificationType,
    };

    return result;
  },
);
