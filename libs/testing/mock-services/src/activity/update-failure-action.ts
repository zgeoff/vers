import * as db from '../db';
import { os } from './os';

export const updateFailureAction = os.updateFailureAction.handler(async (opts) => {
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

  await db.avatarCollection.update(avatar, {
    data(record) {
      record.failureAction = opts.input.failureAction;
    },
  });

  return { failureAction: opts.input.failureAction };
});
