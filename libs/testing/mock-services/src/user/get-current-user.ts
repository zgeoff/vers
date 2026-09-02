import * as db from '../db';
import { os } from './os';

export const getCurrentUser = os.getCurrentUser.handler((opts) => {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const user = db.userCollection.findFirst((q) => q.where({ id: actingUserID }));

  if (user === undefined) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  return user;
});
