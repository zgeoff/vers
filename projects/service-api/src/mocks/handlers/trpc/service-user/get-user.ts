import { TRPCError } from '@trpc/server';
import { db } from '../../../db';
import { trpc } from './trpc';

export const getUser = trpc.getUser.query((opts) => {
  if (!opts.input.id && !opts.input.email) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Either ID or email must be provided',
    });
  }

  const user = db.user.findFirst({
    where: {
      ...(opts.input.id && { id: { equals: opts.input.id } }),
      ...(opts.input.email && { email: { equals: opts.input.email } }),
    },
  });

  return user;
});
