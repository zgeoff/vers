import { TRPCError } from '@trpc/server';
import type { ResetPasswordPayload } from '@vers/service-types';
import { db } from '../../../db';
import { trpc } from './trpc';

export const resetPassword = trpc.resetPassword.mutation((opts) => {
  try {
    const user = db.user.findFirst({
      where: {
        id: { equals: opts.input.id },
      },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    const isTokenMismatch = user.passwordResetToken !== opts.input.resetToken;

    if (isTokenMismatch) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid reset token',
      });
    }

    const isTokenExpired =
      user.passwordResetTokenExpiresAt && user.passwordResetTokenExpiresAt < new Date();

    if (isTokenExpired) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Reset token expired',
      });
    }

    db.user.update({
      data: {
        passwordHash: opts.input.password,
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
      },
      where: {
        id: { equals: user.id },
      },
    });

    db.session.deleteMany({
      where: {
        userID: { equals: user.id },
      },
    });

    const result: ResetPasswordPayload = {};

    return result;
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unknown error occurred',
    });
  }
});
