import { createId } from '@paralleldrive/cuid2';
import * as db from '../db';
import { os } from './os';

/**
 * Avatar names are unique globally, not per user, mirroring the real service.
 */
export const createAvatar = os.createAvatar.handler((opts) => {
  const actingUserId = opts.context.actingUserId;

  if (actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  if (db.avatarCollection.findFirst((q) => q.where({ name: opts.input.name })) !== undefined) {
    throw opts.errors.CONFLICT({ data: {} });
  }

  const now = new Date();

  return db.avatarCollection.create({
    createdAt: now,
    id: createId(),
    level: 1,
    name: opts.input.name,
    updatedAt: now,
    userID: actingUserId,
    xp: 0,
  });
});
