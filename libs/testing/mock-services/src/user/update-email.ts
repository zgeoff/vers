import * as db from '../db';
import { os } from './os';

export const updateEmail = os.updateEmail.handler(async (opts) => {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const user = db.userCollection.findFirst((q) => q.where({ id: actingUserID }));

  if (user === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  if (db.userCollection.findFirst((q) => q.where({ email: opts.input.email })) !== undefined) {
    throw opts.errors.CONFLICT({ data: { field: 'email' } });
  }

  await db.userCollection.update(user, {
    data(record) {
      record.email = opts.input.email;
    },
  });

  return { updatedID: actingUserID };
});
