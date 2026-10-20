import * as db from '../db';
import { os } from './os';

export const getActivityRewards = os.getActivityRewards.handler((opts) => {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const activity = db.activityCollection.findFirst((query) =>
    query.where({ id: opts.input.activityID }),
  );

  if (activity === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const avatar = db.avatarCollection.findFirst((query) =>
    query.where({ id: activity.avatarID, userID: actingUserID }),
  );

  if (avatar === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const minChainIndex = Math.max(activity.startChainIndex, opts.input.afterChainIndex ?? -1);
  const maxChainIndex = activity.startChainIndex + activity.verifiedHead;

  const rows = db.avatarItemCollection.findMany(
    (query) =>
      query.where({
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
