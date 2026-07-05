import { TRPCError } from '@trpc/server';
import type { UpdateUserPayload } from '@vers/service-types';
import { omitNullish } from '../../../../utils/omit-nullish';
import { db } from '../../../db';
import { trpc } from './trpc';

export const updateUser = trpc.updateUser.mutation((opts) => {
  const { id, ...update } = opts.input;

  const user = db.user.findFirst({
    where: { id: { equals: id } },
  });

  if (!user) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'User not found',
    });
  }

  const updatedUser = db.user.update({
    data: omitNullish(update),
    where: { id: { equals: id } },
  });

  if (!updatedUser) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to update user',
    });
  }

  const result: UpdateUserPayload = {
    updatedID: updatedUser.id,
  };

  return result;
});
