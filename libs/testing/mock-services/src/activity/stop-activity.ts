import * as db from '../db';
import { os } from './os';

export const stopActivity = os.stopActivity.handler(async (opts) => {
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

  // The targeted form is idempotent: a row that already left `active` succeeds as-is, and no row
  // other than the targeted one is ever touched.
  const activityID = opts.input.activityID;

  const row =
    activityID === undefined
      ? db.activityCollection.findFirst((q) =>
          q.where({ avatarID: opts.input.avatarID, status: 'active' }),
        )
      : db.activityCollection.findFirst((q) =>
          q.where({ avatarID: opts.input.avatarID, id: activityID }),
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
