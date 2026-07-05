import type { ResetPasswordPayload } from '@vers/service-types';
import { TRPCError } from '@trpc/server';
import * as schema from '@vers/postgres-schema';
import { hashPassword } from '@vers/service-utils';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '~/logger';
import type { Context } from '../types';
import { t } from '../t';

export const ResetPasswordInputSchema = z.object({
  id: z.string(),
  password: z.string(),
  resetToken: z.string(),
});

export async function resetPassword(
  input: z.infer<typeof ResetPasswordInputSchema>,
  ctx: Context,
): Promise<ResetPasswordPayload> {
  try {
    const { id, password, resetToken } = input;

    const user = await ctx.db.query.users.findFirst({
      where: eq(schema.users.id, id),
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No user with that ID',
      });
    }

    const isTokenMismatch = user.passwordResetToken !== resetToken;

    if (isTokenMismatch) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid reset token',
      });
    }

    const isTokenExpired =
      user.passwordResetTokenExpiresAt &&
      user.passwordResetTokenExpiresAt < new Date();

    if (isTokenExpired) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Reset token expired',
      });
    }

    const passwordHash = await hashPassword(password);

    await ctx.db.transaction(async (tx) => {
      // delete all sessions for this user
      await tx.delete(schema.sessions).where(eq(schema.sessions.userID, id));

      // update the user's password
      const [updatedUser] = await tx
        .update(schema.users)
        .set({
          passwordHash,
          passwordResetToken: null,
          passwordResetTokenExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, id))
        .returning();

      return [updatedUser];
    });

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
  .input(ResetPasswordInputSchema)
  .mutation(async ({ ctx, input }) => resetPassword(input, ctx));
