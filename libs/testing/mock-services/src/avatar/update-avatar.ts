import * as db from '../db';
import { os } from './os';

export const updateAvatar = os.updateAvatar.handler(async (opts) => {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const avatar = db.avatarCollection.findFirst((q) =>
    q.where({ id: opts.input.id, userID: actingUserID }),
  );

  if (avatar === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  await db.avatarCollection.update(avatar, {
    data(record) {
      record.name = opts.input.name;

      record.updatedAt = new Date();
    },
  });

  return { updatedID: avatar.id };
});
