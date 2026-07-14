import * as db from '../db';
import { os } from './os';

export const stopActivity = os.stopActivity.handler(async (opts) => {
  const actingUserId = opts.context.actingUserId;

  if (actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const active = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: opts.input.avatarID, status: 'active' }),
  );

  if (active === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const stopped = await db.activityCollection.update(active, {
    data(record) {
      record.status = 'stopped';

      record.stoppedAt = new Date();
      record.updatedAt = new Date();
    },
    strict: true,
  });

  return stopped;
});
