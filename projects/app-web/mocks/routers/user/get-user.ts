import { userCollection } from '../../db/user-collection';
import { os } from './os';

export const getUser = os.getUser.handler((opts) => {
  const { id } = opts.input;
  const { email } = opts.input;

  if (id !== undefined) {
    return userCollection.findFirst((q) => q.where({ id })) ?? null;
  }

  if (email !== undefined) {
    return userCollection.findFirst((q) => q.where({ email })) ?? null;
  }

  return null;
});
