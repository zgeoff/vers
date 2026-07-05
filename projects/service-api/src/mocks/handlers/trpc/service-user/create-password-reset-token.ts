import type { CreatePasswordResetTokenPayload } from '@vers/service-types';
import { TRPCError } from '@trpc/server';
import { db } from '../../../db';
import { trpc } from './trpc';

export const createPasswordResetToken = trpc.createPasswordResetToken.mutation(
  ({ input }) => {
    const user = db.user.findFirst({
      where: {
        id: { equals: input.id },
      },
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

    const resetToken = `mock_reset_token_${Date.now()}`;

    db.user.update({
      data: {
        passwordResetToken: resetToken,
        passwordResetTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
      where: {
        id: { equals: user.id },
      },
    });

    const result: CreatePasswordResetTokenPayload = {
      resetToken,
    };

    return result;
  },
);
