import type { DeleteSessionPayload } from '@vers/service-types';
import { db } from '../../../db';
import { trpc } from './trpc';

export const deleteSession = trpc.deleteSession.mutation(({ input }) => {
  db.session.delete({
    where: {
      id: { equals: input.id },
      userID: { equals: input.userID },
    },
  });

  const result: DeleteSessionPayload = {};

  return result;
});
