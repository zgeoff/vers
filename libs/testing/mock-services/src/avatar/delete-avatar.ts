import * as db from '../db';
import { os } from './os';

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

  // mirrors the real table's FK cascade: deleting the active avatar drops the selection
  const selection = db.activeAvatarCollection.findFirst((q) =>
    q.where({ avatarID: avatar.id, userID: actingUserId }),
  );

  if (selection !== undefined) {
    db.activeAvatarCollection.delete(selection);
  }

  return { deletedID: avatar.id };
});
