import { TRPCError } from '@trpc/server';
import type { UpdateUserPayload } from '@vers/service-types';
import { db } from '../../../db';
import { trpc } from './trpc';

export const updateEmail = trpc.updateEmail.mutation((opts) => {
  const user = db.user.findFirst({
    where: { id: { equals: opts.input.id } },
  });

  if (!user) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'User not found',
    });
  }

  const twoFactorVerification = db.verification.findFirst({
    where: {
      target: { equals: opts.input.email },
      type: { in: ['2fa', '2fa-setup'] },
    },
  });

  const updatedUser = db.user.update({
    data: { email: opts.input.email },
    where: { id: { equals: opts.input.id } },
  });

  if (!updatedUser) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to update user',
    });
  }

  if (twoFactorVerification) {
    db.verification.update({
      data: { target: opts.input.email },
      where: { id: { equals: twoFactorVerification.id } },
    });
  }

  const result: UpdateUserPayload = {
    updatedID: updatedUser.id,
  };

  return result;
});
