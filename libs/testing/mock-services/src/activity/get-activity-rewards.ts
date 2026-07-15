import * as db from '../db';
import { os } from './os';

/**
 * Returns an owned activity's revealed reward-slot contents. The mock backend carries no minted
 * `avatar_items` rows, so `items` is always empty — a test asserting on revealed content seeds its
 * own override.
 */
export const getActivityRewards = os.getActivityRewards.handler((opts) => {
  const actingUserId = opts.context.actingUserId;

  if (actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const activity = db.activityCollection.findFirst((q) => q.where({ id: opts.input.activityID }));

  if (activity === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const avatar = db.avatarCollection.findFirst((q) =>
    q.where({ id: activity.avatarID, userID: actingUserId }),
  );

  if (avatar === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  return { items: [], verifiedHead: activity.verifiedHead };
});
