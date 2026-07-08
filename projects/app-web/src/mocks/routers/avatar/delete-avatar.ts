import * as db from '../../db';
import { os } from './os';

/** Removes an avatar owned by the acting user; throws NOT_FOUND when they don't own it. */
export const deleteAvatar = os.deleteAvatar.handler((opts) => {
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

  db.avatarCollection.delete(avatar);

  return { deletedID: avatar.id };
});
