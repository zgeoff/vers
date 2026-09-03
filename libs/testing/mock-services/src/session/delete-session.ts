import * as db from '../db';
import { os } from './os';

export const deleteSession = os.deleteSession.handler((opts) => {
  if (opts.context.actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const session = db.sessionCollection.findFirst((q) => q.where({ id: opts.input.id }));

  if (session !== undefined && session.userID === opts.context.actingUserID) {
    db.sessionCollection.delete(session);
  }

  return {};
});
