import * as db from '../db';
import { os } from './os';

export const getLatestActivityProgress = os.getLatestActivityProgress.handler((opts) => {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const avatar = db.avatarCollection.findFirst((q) =>
    q.where({ id: opts.input.avatarID, userID: actingUserID }),
  );

  if (avatar === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const activities = db.activityCollection.findMany((q) =>
    q.where({ avatarID: opts.input.avatarID }),
  );

  const [latest] = activities.toSorted((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

  if (latest === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const anchor =
    latest.verifiedHead === 0
      ? undefined
      : db.checkpointCollection.findFirst((q) =>
          q.where({ activityID: latest.id, version: latest.verifiedHead }),
        );

  return {
    activity: latest,
    anchor: anchor ?? null,
    appendedHead: latest.appendedHead,
    failureAction: avatar.failureAction,

    // the mock backend tracks no writer session, so every caller may append
    isWriter: true,

    serverTime: new Date(),
    verifiedHead: latest.verifiedHead,
  };
});
