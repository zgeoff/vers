import { createId } from '@paralleldrive/cuid2';
import { AVATAR_MODE_CAP } from '@vers/contract-avatar';
import * as db from '../db';
import { findLiveActivityAvatar } from './find-live-activity-avatar';
import { os } from './os';
import { upsertActiveAvatar } from './upsert-active-avatar';

/**
 * Avatar names are unique globally, not per user, mirroring the real service; so are the per-mode
 * cap and the auto-select that yields to a live activity's hold on the selection.
 */
export const createAvatar = os.createAvatar.handler(async (opts) => {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  if (db.avatarCollection.findFirst((q) => q.where({ name: opts.input.name })) !== undefined) {
    throw opts.errors.CONFLICT({ data: {} });
  }

  const held = db.avatarCollection.findMany((q) =>
    q.where({ mode: opts.input.mode, userID: actingUserID }),
  );

  if (held.length >= AVATAR_MODE_CAP) {
    throw opts.errors.LIMIT_REACHED({ data: { cap: AVATAR_MODE_CAP, mode: opts.input.mode } });
  }

  const now = new Date();

  const avatar = await db.avatarCollection.create({
    createdAt: now,
    id: createId(),
    level: 1,
    mode: opts.input.mode,
    name: opts.input.name,
    updatedAt: now,
    userID: actingUserID,
    xp: 0,
  });

  if (findLiveActivityAvatar(actingUserID) === null) {
    await upsertActiveAvatar(actingUserID, avatar.id);
  }

  return avatar;
});
