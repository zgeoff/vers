import { avatarCollection } from '../../db/avatar-collection';
import { os } from './os';

/** Lists every avatar owned by the acting user. */
export const getAvatars = os.getAvatars.handler((opts) => {
  const actingUserId = opts.context.actingUserId;

  if (actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  return avatarCollection.findMany((q) => q.where({ userID: actingUserId }));
});
