import * as db from '../db';
import { findLiveActivityAvatar } from './find-live-activity-avatar';
import { os } from './os';
import { upsertActiveAvatar } from './upsert-active-avatar';

export const selectAvatar = os.selectAvatar.handler(async (opts) => {
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

  const liveAvatar = findLiveActivityAvatar(actingUserID);

  if (liveAvatar !== null && liveAvatar.id !== avatar.id) {
    throw opts.errors.CONFLICT({
      data: { owningAvatarID: liveAvatar.id, owningAvatarName: liveAvatar.name },
    });
  }

  await upsertActiveAvatar(actingUserID, avatar.id);

  return { activeAvatarID: avatar.id };
});
