import type { UpdateUserPayload } from '@vers/service-types';
import { TRPCError } from '@trpc/server';
import * as schema from '@vers/postgres-schema';
import { NameSchema, UsernameSchema } from '@vers/validation';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '~/logger';
import type { Context } from '../types';
import { t } from '../t';

export const UpdateUserInputSchema = z.object({
  id: z.string(),
  name: NameSchema.optional(),
  username: UsernameSchema.optional(),
});

export async function updateUser(
  input: z.infer<typeof UpdateUserInputSchema>,
  ctx: Context,
): Promise<UpdateUserPayload> {
  try {
    const { id, ...update } = input;

    const [user] = await ctx.db
      .update(schema.users)
      .set({
        ...update,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, id))
      .returning({
        updatedID: schema.users.id,
      });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }
    return { updatedID: user.updatedID };
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
  .input(UpdateUserInputSchema)
  .mutation(async ({ ctx, input }) => updateUser(input, ctx));
