import * as db from '../db';
import { os } from './os';

export const changePassword = os.changePassword.handler(async (opts) => {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const user = db.userCollection.findFirst((q) => q.where({ id: actingUserID }));

  if (user === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  await db.userCollection.update(user, {
    data(record) {
      record.password = opts.input.password;
    },
  });

  return { updatedID: actingUserID };
});
