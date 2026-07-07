import { userCollection } from '../../db/user-collection';
import { os } from './os';

export const getCurrentUser = os.getCurrentUser.handler((opts) => {
  const { actingUserId } = opts.context;

  if (actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const user = userCollection.findFirst((q) => q.where({ id: actingUserId }));

  if (user === undefined) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  return user;
});
