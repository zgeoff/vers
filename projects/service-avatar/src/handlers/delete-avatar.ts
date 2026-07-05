import { TRPCError } from '@trpc/server';
import * as schema from '@vers/postgres-schema';
import type { DeleteAvatarPayload } from '@vers/service-types';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '../logger';
import { t } from '../t';
import type { Context } from '../types';

const DeleteAvatarInputSchema = z.object({
  id: z.string(),
  userID: z.string(),
});

async function deleteAvatar(
  input: z.infer<typeof DeleteAvatarInputSchema>,
  ctx: Context,
): Promise<DeleteAvatarPayload> {
  try {
    const [avatar] = await ctx.db
      .delete(schema.avatars)
      .where(eq(schema.avatars.id, input.id))
      .returning({ id: schema.avatars.id });

    if (!avatar) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Avatar not found',
      });
    }

    return { deletedID: avatar.id };
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
  .input(DeleteAvatarInputSchema)
  .mutation((opts) => deleteAvatar(opts.input, opts.ctx));
