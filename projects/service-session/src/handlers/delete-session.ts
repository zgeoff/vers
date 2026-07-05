import type { DeleteSessionPayload } from '@vers/service-types';
import { TRPCError } from '@trpc/server';
import * as schema from '@vers/postgres-schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Context } from '../types';
import { logger } from '../logger';
import { t } from '../t';

export const DeleteSessionInputSchema = z.object({
  id: z.string(),
  userID: z.string(),
});

export async function deleteSession(
  input: z.infer<typeof DeleteSessionInputSchema>,
  ctx: Context,
): Promise<DeleteSessionPayload> {
  try {
    await ctx.db
      .delete(schema.sessions)
      .where(
        and(
          eq(schema.sessions.id, input.id),
          eq(schema.sessions.userID, input.userID),
        ),
      );

    return {};
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
  .input(DeleteSessionInputSchema)
  .mutation(async ({ ctx, input }) => deleteSession(input, ctx));
