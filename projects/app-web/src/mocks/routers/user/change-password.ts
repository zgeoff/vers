import { userCollection } from '../../db/user-collection';
import { os } from './os';

export const changePassword = os.changePassword.handler(async (opts) => {
  const actingUserId = opts.context.actingUserId;

  if (actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const user = userCollection.findFirst((q) => q.where({ id: actingUserId }));

  if (user === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  await userCollection.update(user, {
    data(record) {
      record.password = opts.input.password;
    },
  });

  return { updatedID: actingUserId };
});
