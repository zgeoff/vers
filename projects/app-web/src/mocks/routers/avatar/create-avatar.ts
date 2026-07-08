import { createId } from '@paralleldrive/cuid2';
import * as db from '../../db';
import { os } from './os';

/** Creates an avatar owned by the acting user; mirrors the service's global name uniqueness. */
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
    class: opts.input.class,
    createdAt: now,
    id: createId(),
    level: 1,
    name: opts.input.name,
    updatedAt: now,
    userID: actingUserId,
    xp: 0,
  });
});
