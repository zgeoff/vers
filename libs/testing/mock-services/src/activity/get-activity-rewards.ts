import * as db from '../db';
import { os } from './os';

/**
 * Returns an owned activity's revealed reward-slot contents: the minted `avatarItemCollection` rows
 * matching the activity's scope, gated to coordinates at or below its verified anchor and ordered by
 * chain position then slot ordinal. Seed the collection to assert on revealed content.
 */
export const getActivityRewards = os.getActivityRewards.handler((opts) => {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const activity = db.activityCollection.findFirst((q) => q.where({ id: opts.input.activityID }));

  if (activity === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const avatar = db.avatarCollection.findFirst((q) =>
    q.where({ id: activity.avatarID, userID: actingUserID }),
  );

  if (avatar === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const minChainIndex = Math.max(activity.startChainIndex, opts.input.afterChainIndex ?? -1);
  const maxChainIndex = activity.startChainIndex + activity.verifiedHead;

  const rows = db.avatarItemCollection.findMany(
    (q) =>
      q.where({
        avatarID: activity.avatarID,
        chainIndex: (value) => value > minChainIndex && value <= maxChainIndex,
        scopeID: activity.scopeID,
        scopeType: activity.scopeType,
      }),
    { orderBy: [{ chainIndex: 'asc' }, { ordinal: 'asc' }] },
  );

  return {
    items: rows.map((row) => ({
      chainIndex: row.chainIndex,
      item: {
        affixes: row.affixes,
        baseID: row.baseID,
        contentVersion: row.contentVersion,
        rarityID: row.rarityID,
      },
      ordinal: row.ordinal,
    })),
    verifiedHead: activity.verifiedHead,
  };
});
