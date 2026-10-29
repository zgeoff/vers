import * as db from '../db';
import { os } from './os';
import { readOptimisticBuild } from './read-optimistic-build';

export const getLatestActivityProgress = os.getLatestActivityProgress.handler((opts) => {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const avatar = db.avatarCollection.findFirst((query) =>
    query.where({ id: opts.input.avatarID, userID: actingUserID }),
  );

  if (avatar === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const activities = db.activityCollection.findMany((query) =>
    query.where({ avatarID: opts.input.avatarID }),
  );

  const [latest] = activities.toSorted(
    (left, right) => right.startedAt.getTime() - left.startedAt.getTime(),
  );

  if (latest === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const anchor =
    latest.verifiedHead === 0
      ? undefined
      : db.checkpointCollection.findFirst((query) =>
          query.where({ activityID: latest.id, version: latest.verifiedHead }),
        );

  return {
    activity: latest,
    anchor: anchor ?? null,
    appendedHead: latest.appendedHead,
    failureAction: avatar.failureAction,

    // the mock backend tracks no writer session, so every caller may append
    isWriter: true,

    optimisticBuild: readOptimisticBuild({ avatarID: avatar.id, settledXP: avatar.xp }),
    serverTime: new Date(),
    verifiedHead: latest.verifiedHead,
  };
});
