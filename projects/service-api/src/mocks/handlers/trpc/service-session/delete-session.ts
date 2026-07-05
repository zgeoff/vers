import type { DeleteSessionPayload } from '@vers/service-types';
import { db } from '../../../db';
import { trpc } from './trpc';

export const deleteSession = trpc.deleteSession.mutation((opts) => {
  db.session.delete({
    where: {
      id: { equals: opts.input.id },
      userID: { equals: opts.input.userID },
    },
  });

  const result: DeleteSessionPayload = {};

  return result;
});
