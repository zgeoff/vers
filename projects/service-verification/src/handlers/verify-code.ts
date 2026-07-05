import { verifyTOTP } from '@epic-web/totp';
import { TRPCError } from '@trpc/server';
import * as schema from '@vers/postgres-schema';
import type { VerifyCodePayload } from '@vers/service-types';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '../logger';
import { t } from '../t';
import type { Context } from '../types';

export const VerifyCodeInputSchema = z.object({
  code: z.string(),
  target: z.string(),
  type: z.enum(['2fa', '2fa-setup', 'change-email', 'onboarding']),
});

export async function verifyCode(
  input: z.infer<typeof VerifyCodeInputSchema>,
  ctx: Context,
): Promise<VerifyCodePayload> {
  try {
    const { code, target, type } = input;

    const verification = await ctx.db.query.verifications.findFirst({
      where: and(eq(schema.verifications.type, type), eq(schema.verifications.target, target)),
    });

    if (!verification) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid verification code',
      });
    }

    if (verification.expiresAt && verification.expiresAt < new Date()) {
      await ctx.db.delete(schema.verifications).where(eq(schema.verifications.id, verification.id));

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Verification code has expired',
      });
    }

    const result = await verifyTOTP({
      otp: code,
      ...verification,
    });

    if (!result) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid verification code',
      });
    }

    const is2FAVerification = verification.type === '2fa-setup' || verification.type === '2fa';

    if (!is2FAVerification) {
      await ctx.db.delete(schema.verifications).where(eq(schema.verifications.id, verification.id));
    }

    return {
      id: verification.id,
      target: verification.target,
      type: verification.type,
    };
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
  .input(VerifyCodeInputSchema)
  .mutation((opts) => verifyCode(opts.input, opts.ctx));
