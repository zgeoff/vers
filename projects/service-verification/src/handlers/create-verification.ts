import { generateTOTP } from '@epic-web/totp';
import { createId } from '@paralleldrive/cuid2';
import { TRPCError } from '@trpc/server';
import * as schema from '@vers/postgres-schema';
import type { CreateVerificationPayload, VerificationType } from '@vers/service-types';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '../logger';
import { t } from '../t';
import type { Context } from '../types';

// alphanumeirc excluding 0, O, and I on purpose to avoid confusing users
const TOTP_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789';

// standard charset used by 2FA apps
const TWO_FACTOR_CHARSET = '0123456789';

const VERIFICATION_TYPE_TO_CHARSET: Record<VerificationType, string> = {
  '2fa': TWO_FACTOR_CHARSET,
  '2fa-setup': TWO_FACTOR_CHARSET,
  'change-email': TOTP_CHARSET,
  onboarding: TOTP_CHARSET,
};

export const CreateVerificationInputSchema = z.object({
  expiresAt: z.date().nullable().optional(),
  period: z.number().optional(),
  target: z.string(),
  type: z.enum(['2fa', '2fa-setup', 'change-email', 'onboarding']),
});

export async function createVerification(
  input: z.infer<typeof CreateVerificationInputSchema>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  ctx: Context,
): Promise<CreateVerificationPayload> {
  try {
    const { expiresAt, period, target, type } = input;

    // delete any existing verifications for this target and type to invalidate previous codes
    await ctx.db
      .delete(schema.verifications)
      .where(and(eq(schema.verifications.target, target), eq(schema.verifications.type, type)));

    const { otp, ...verificationConfig } = await generateTOTP({
      algorithm: 'SHA-256',
      charSet: VERIFICATION_TYPE_TO_CHARSET[type],
      ...(period !== undefined && { period }),
    });

    const verification: typeof schema.verifications.$inferSelect = {
      createdAt: new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      id: createId(),
      target,
      type,
      ...verificationConfig,
    };

    await ctx.db.insert(schema.verifications).values(verification);

    const payload = {
      id: verification.id,
      otp,
      target: verification.target,
      type: verification.type,
    };

    return payload;
  } catch (error: unknown) {
    logger.error(error);

    if (error instanceof TRPCError) {
      throw error;
    }

    throw new TRPCError({
      cause: error,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unknown error occurred',
    });
  }
}

export const procedure = t.procedure
  .input(CreateVerificationInputSchema)
  .mutation((opts) => createVerification(opts.input, opts.ctx));
