import * as db from '../db';
import { os } from './os';

/**
 * Returns the active activity as-is: the mock backend tracks no writer session, so taking over
 * as writer is a no-op here — SESSION_EVICTED flows are a per-test override.
 */
export const resumeActivity = os.resumeActivity.handler((opts) => {
  const actingUserId = opts.context.actingUserId;

  if (actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const activity = db.activityCollection.findFirst((q) =>
    q.where({ id: opts.input.activityID, status: 'active' }),
  );

  if (activity === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  return activity;
});
