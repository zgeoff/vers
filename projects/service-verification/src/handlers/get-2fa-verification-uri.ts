import { getTOTPAuthUri } from '@epic-web/totp';
import { TRPCError } from '@trpc/server';
import * as schema from '@vers/postgres-schema';
import type { Get2FAVerificationURIPayload } from '@vers/service-types';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '../logger';
import { t } from '../t';
import type { Context } from '../types';

export const Get2FAVerificationURIInputSchema = z.object({
  target: z.string(),
});

export async function get2FAVerificationURI(
  input: z.infer<typeof Get2FAVerificationURIInputSchema>,
  ctx: Context,
): Promise<Get2FAVerificationURIPayload> {
  try {
    const verification = await ctx.db.query.verifications.findFirst({
      where: and(
        eq(schema.verifications.type, '2fa-setup'),
        eq(schema.verifications.target, input.target),
      ),
    });

    if (!verification) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No 2FA verification found for this target',
      });
    }

    const otpURI = getTOTPAuthUri({
      accountName: input.target,
      algorithm: verification.algorithm,
      digits: verification.digits,
      issuer: 'vers',
      period: verification.period,
      secret: verification.secret,
    });

    return { otpURI };
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
  .input(Get2FAVerificationURIInputSchema)
  .query((opts) => get2FAVerificationURI(opts.input, opts.ctx));
