import * as db from '../db';
import { os } from './os';

export const getAvatar = os.getAvatar.handler((opts) => {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const avatar = db.avatarCollection.findFirst((query) =>
    query.where({ id: opts.input.id, userID: actingUserID }),
  );

  return avatar ?? null;
});
