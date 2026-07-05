import { db } from '../../../db';
import { trpc } from './trpc';

export const getSessions = trpc.getSessions.query((opts) => {
  const sessions = db.session.findMany({
    where: { userID: { equals: opts.input.userID } },
  });

  return sessions;
});
