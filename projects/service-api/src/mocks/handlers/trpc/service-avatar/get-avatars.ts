import { db } from '../../../db';
import { trpc } from './trpc';

export const getAvatars = trpc.getAvatars.query((opts) => {
  const avatars = db.avatar.findMany({
    where: {
      userID: { equals: opts.input.userID },
    },
  });

  return avatars;
});
