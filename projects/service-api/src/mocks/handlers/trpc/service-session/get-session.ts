import { db } from '../../../db';
import { trpc } from './trpc';

export const getSession = trpc.getSession.query((opts) => {
  const session = db.session.findFirst({
    where: { id: { equals: opts.input.id } },
  });

  return session;
});
