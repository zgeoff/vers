import { TRPCError } from '@trpc/server';
import { db } from '../../../db';
import { trpc } from './trpc';

export const updateAvatar = trpc.updateAvatar.mutation((opts) => {
  const avatar = db.avatar.findFirst({
    where: {
      id: { equals: opts.input.id },
      userID: { equals: opts.input.userID },
    },
  });

  if (!avatar) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Avatar not found',
    });
  }

  db.avatar.update({
    data: {
      name: opts.input.name,
      updatedAt: new Date(),
    },
    where: {
      id: { equals: opts.input.id },
    },
  });

  return { updatedID: avatar.id };
});
