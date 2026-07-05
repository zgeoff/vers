import { TRPCError } from '@trpc/server';
import * as schema from '@vers/postgres-schema';
import type { UpdateVerificationPayload } from '@vers/service-types';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '../logger';
import { t } from '../t';
import type { Context } from '../types';

export const UpdateVerificationInputSchema = z.object({
  id: z.string(),
  type: z.enum(['2fa', '2fa-setup', 'change-email', 'onboarding']).optional(),
});

export async function updateVerification(
  input: z.infer<typeof UpdateVerificationInputSchema>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  ctx: Context,
): Promise<UpdateVerificationPayload> {
  try {
    const { id, ...update } = input;

    const [verification] = await ctx.db
      .update(schema.verifications)
      .set(update)
      .where(eq(schema.verifications.id, id))
      .returning({
        updatedID: schema.verifications.id,
      });

    if (!verification) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Verification not found',
      });
    }

    return { updatedID: verification.updatedID };
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
  .input(UpdateVerificationInputSchema)
  .mutation((opts) => updateVerification(opts.input, opts.ctx));
