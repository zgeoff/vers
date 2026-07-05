import { TRPCError } from '@trpc/server';
import { db } from '../../../db';
import { trpc } from './trpc';

export const getUser = trpc.getUser.query((opts) => {
  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  if (!opts.input.id && !opts.input.email) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Either ID or email must be provided',
    });
  }

  const user = db.user.findFirst({
    where: {
      // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
      ...(opts.input.id && { id: { equals: opts.input.id } }),
      // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
      ...(opts.input.email && { email: { equals: opts.input.email } }),
    },
  });

  return user;
});
