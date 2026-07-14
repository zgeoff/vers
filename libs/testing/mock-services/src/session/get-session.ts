import * as db from '../db';
import { os } from './os';

export const getSession = os.getSession.handler((opts) => {
  const actingUserId = opts.context.actingUserId;

  if (actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const session = db.sessionCollection.findFirst((q) => q.where({ id: opts.input.id }));

  if (session === undefined || session.userID !== actingUserId) {
    return null;
  }

  return session;
});
