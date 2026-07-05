import type { CreatePasswordResetTokenPayload } from '@vers/service-types';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { TRPCError } from '@trpc/server';
import * as schema from '@vers/postgres-schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '~/logger';
import type { Context } from '../types';
import { t } from '../t';

const randomBytesAsync = promisify(randomBytes);

export const CreatePasswordResetTokenInputSchema = z.object({
  id: z.string(),
});

export async function createPasswordResetToken(
  input: z.infer<typeof CreatePasswordResetTokenInputSchema>,
  ctx: Context,
): Promise<CreatePasswordResetTokenPayload> {
  try {
    const user = await ctx.db.query.users.findFirst({
      where: eq(schema.users.id, input.id),
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    if (!user.passwordHash) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'User has no password',
      });
    }

    const tokenBytes = await randomBytesAsync(32);
    const resetToken = tokenBytes.toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // intentionally not updating our user record's `updatedAt` field
    // so that it's reflective of information that matters to the user
    await ctx.db
      .update(schema.users)
      .set({
        passwordResetToken: resetToken,
        passwordResetTokenExpiresAt: expiresAt,
      })
      .where(eq(schema.users.id, input.id));

    return { resetToken };
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
  .input(CreatePasswordResetTokenInputSchema)
  .mutation(async ({ ctx, input }) => createPasswordResetToken(input, ctx));
