import * as db from '../../db';
import { os } from './os';

/** Renames an avatar owned by the acting user; throws NOT_FOUND when they don't own it. */
export const updateAvatar = os.updateAvatar.handler(async (opts) => {
  const actingUserId = opts.context.actingUserId;

  if (actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const avatar = db.avatarCollection.findFirst((q) =>
    q.where({ id: opts.input.id, userID: actingUserId }),
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
