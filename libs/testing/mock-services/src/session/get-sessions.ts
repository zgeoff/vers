import * as db from '../db';
import { os } from './os';

export const getSessions = os.getSessions.handler((opts) => {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  return db.sessionCollection.findMany((q) => q.where({ userID: actingUserID }));
});
