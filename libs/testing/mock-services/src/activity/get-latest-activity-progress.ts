import * as db from '../db';
import { os } from './os';

/**
 * Returns the avatar's most recently started activity with its resume progress. The anchor is
 * null while `verifiedHead` is still 0 — the mock never runs verification, so a test that wants
 * an anchor seeds `verifiedHead` and its checkpoint row directly.
 */
export const getLatestActivityProgress = os.getLatestActivityProgress.handler((opts) => {
  const actingUserId = opts.context.actingUserId;

  if (actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const avatar = db.avatarCollection.findFirst((q) =>
    q.where({ id: opts.input.avatarID, userID: actingUserId }),
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
    serverTime: new Date(),
    verifiedHead: latest.verifiedHead,
  };
});
