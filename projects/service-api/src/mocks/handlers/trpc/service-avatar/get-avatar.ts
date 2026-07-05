import { db } from '../../../db';
import { trpc } from './trpc';

export const getAvatar = trpc.getAvatar.query((opts) => {
  const avatar = db.avatar.findFirst({
    where: { id: { equals: opts.input.id } },
  });

  return avatar ?? null;
});
