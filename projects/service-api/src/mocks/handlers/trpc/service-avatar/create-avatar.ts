import { TRPCError } from '@trpc/server';
import { db } from '../../../db';
import { trpc } from './trpc';

export const createAvatar = trpc.createAvatar.mutation((opts) => {
  const existingAvatar = db.avatar.findFirst({
    where: {
      name: { equals: opts.input.name },
    },
  });

  if (existingAvatar) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'An Avatar with that name already exists',
    });
  }

  const avatar = db.avatar.create({
    class: opts.input.class,
    name: opts.input.name,
    userID: opts.input.userID,
  });

  return avatar;
});
