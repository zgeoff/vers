import * as db from '../db';
import { os } from './os';

export const stopActivity = os.stopActivity.handler(async (opts) => {
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

  const activityID = opts.input.activityID;

  const row =
    activityID === undefined
      ? db.activityCollection.findFirst((query) =>
          query.where({ avatarID: opts.input.avatarID, status: 'active' }),
        )
      : db.activityCollection.findFirst((query) =>
          query.where({ avatarID: opts.input.avatarID, id: activityID }),
        );

  if (row === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  if (row.status !== 'active') {
    return row;
  }

  const stopped = await db.activityCollection.update(row, {
    data(record) {
      record.status = 'stopped';

      record.stoppedAt = new Date();
      record.updatedAt = new Date();
    },
    strict: true,
  });

  return stopped;
});
