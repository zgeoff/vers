import * as db from '../db';
import { os } from './os';

export const getSessions = os.getSessions.handler((opts) => {
  const actingUserId = opts.context.actingUserId;

  if (actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  return db.sessionCollection.findMany((q) => q.where({ userID: actingUserId }));
});
