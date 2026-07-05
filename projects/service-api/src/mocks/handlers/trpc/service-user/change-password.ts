import { TRPCError } from '@trpc/server';
import type { ChangePasswordPayload } from '@vers/service-types';
import { db } from '../../../db';
import { trpc } from './trpc';

export const changeUserPassword = trpc.changePassword.mutation((opts) => {
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

    db.user.update({
      data: {
        // in the mock, we store the plaintext password
        passwordHash: opts.input.password,
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

    const result: ChangePasswordPayload = {
      updatedID: user.id,
    };

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
