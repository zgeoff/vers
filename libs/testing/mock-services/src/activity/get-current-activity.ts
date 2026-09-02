import * as db from '../db';
import { os } from './os';

export const getCurrentActivity = os.getCurrentActivity.handler((opts) => {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const avatar = db.avatarCollection.findFirst((q) =>
    q.where({ id: opts.input.avatarID, userID: actingUserID }),
  );

  if (avatar === undefined) {
    return null;
  }

  const activity = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: opts.input.avatarID, status: 'active' }),
  );

  return activity ?? null;
});
