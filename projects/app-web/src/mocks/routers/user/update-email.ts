import { userCollection } from '../../db/user-collection';
import { os } from './os';

export const updateEmail = os.updateEmail.handler(async (opts) => {
  const actingUserId = opts.context.actingUserId;

  if (actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const user = userCollection.findFirst((q) => q.where({ id: actingUserId }));

  if (user === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  if (userCollection.findFirst((q) => q.where({ email: opts.input.email })) !== undefined) {
    throw opts.errors.CONFLICT({ data: { field: 'email' } });
  }

  await userCollection.update(user, {
    data(record) {
      record.email = opts.input.email;
    },
  });

  return { updatedID: actingUserId };
});
