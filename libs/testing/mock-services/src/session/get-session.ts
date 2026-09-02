import * as db from '../db';
import { os } from './os';

export const getSession = os.getSession.handler((opts) => {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const session = db.sessionCollection.findFirst((q) => q.where({ id: opts.input.id }));

  if (session === undefined || session.userID !== actingUserID) {
    return null;
  }

  return session;
});
