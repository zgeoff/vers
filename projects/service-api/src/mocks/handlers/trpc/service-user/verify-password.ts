import { TRPCError } from '@trpc/server';
import { db } from '../../../db';
import { trpc } from './trpc';

export const verifyPassword = trpc.verifyPassword.mutation((opts) => {
  const user = db.user.findFirst({
    where: { email: { equals: opts.input.email } },
  });

  if (!user) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'User not found',
    });
  }

  if (user.passwordHash === null) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'User does not have a password set',
    });
  }

  // for the sake of our msw mocks we just store the raw password instead of the hash
  if (opts.input.password !== user.passwordHash) {
    return { success: false };
  }

  return { success: true };
});
