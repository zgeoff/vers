import { avatarCollection } from '../../db/avatar-collection';
import { os } from './os';

/** Returns an avatar owned by the acting user, or null when it doesn't exist or isn't theirs. */
export const getAvatar = os.getAvatar.handler((opts) => {
  const actingUserId = opts.context.actingUserId;

  if (actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const avatar = avatarCollection.findFirst((q) =>
    q.where({ id: opts.input.id, userID: actingUserId }),
  );

  return avatar ?? null;
});
