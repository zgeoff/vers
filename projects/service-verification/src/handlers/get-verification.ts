import { TRPCError } from '@trpc/server';
import * as schema from '@vers/postgres-schema';
import type { GetVerificationPayload } from '@vers/service-types';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '../logger';
import { t } from '../t';
import type { Context } from '../types';

export const GetVerificationInputSchema = z.object({
  target: z.string(),
  type: z.enum(['2fa', '2fa-setup', 'change-email', 'onboarding']),
});

export async function getVerification(
  input: z.infer<typeof GetVerificationInputSchema>,
  ctx: Context,
): Promise<GetVerificationPayload> {
  try {
    const verification = await ctx.db.query.verifications.findFirst({
      where: and(
        eq(schema.verifications.type, input.type),
        eq(schema.verifications.target, input.target),
      ),
    });

    if (!verification) {
      return null;
    }

    // if the verification has expired, delete it and return null
    if (verification.expiresAt && verification.expiresAt < new Date()) {
      await ctx.db.delete(schema.verifications).where(eq(schema.verifications.id, verification.id));

      return null;
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
  .input(GetVerificationInputSchema)
  .query((opts) => getVerification(opts.input, opts.ctx));
