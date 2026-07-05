import { TRPCError } from '@trpc/server';
import * as schema from '@vers/postgres-schema';
import type { DeleteVerificationPayload } from '@vers/service-types';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '../logger';
import { t } from '../t';
import type { Context } from '../types';

export const DeleteVerificationInputSchema = z.object({
  id: z.string(),
});

export async function deleteVerification(
  input: z.infer<typeof DeleteVerificationInputSchema>,
  ctx: Context,
): Promise<DeleteVerificationPayload> {
  try {
    const [verification] = await ctx.db
      .delete(schema.verifications)
      .where(eq(schema.verifications.id, input.id))
      .returning({
        deletedID: schema.verifications.id,
      });

    if (!verification) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Verification not found',
      });
    }

    const payload = {
      deletedID: verification.deletedID,
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
  .input(DeleteVerificationInputSchema)
  .mutation((opts) => deleteVerification(opts.input, opts.ctx));
