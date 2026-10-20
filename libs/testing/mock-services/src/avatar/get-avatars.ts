import * as db from '../db';
import { os } from './os';

export const getAvatars = os.getAvatars.handler((opts) => {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const avatars = db.avatarCollection.findMany((query) => query.where({ userID: actingUserID }));

  const active = db.activeAvatarCollection.findFirst((query) =>
    query.where({ userID: actingUserID }),
  );

  return { activeAvatarID: active?.avatarID ?? null, avatars };
});
