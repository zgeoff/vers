import { TRPCError } from '@trpc/server';
import * as schema from '@vers/postgres-schema';
import type { UpdateUserPayload } from '@vers/service-types';
import { NameSchema, UsernameSchema } from '@vers/validation';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '../logger';
import { t } from '../t';
import type { Context } from '../types';

export const UpdateUserInputSchema = z.object({
  id: z.string(),
  name: NameSchema.optional(),
  username: UsernameSchema.optional(),
});

export async function updateUser(
  input: z.infer<typeof UpdateUserInputSchema>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
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
  .mutation((opts) => updateUser(opts.input, opts.ctx));
