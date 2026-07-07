import { userCollection } from '../../db/user-collection';
import { os } from './os';

export const getUser = os.getUser.handler((opts) => {
  if (opts.input.id !== undefined) {
    return userCollection.findFirst((q) => q.where({ id: opts.input.id })) ?? null;
  }

  if (opts.input.email !== undefined) {
    return userCollection.findFirst((q) => q.where({ email: opts.input.email })) ?? null;
  }

  return null;
});
