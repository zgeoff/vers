import * as db from '../db';
import { os } from './os';

export const getUser = os.getUser.handler((opts) => {
  const id = opts.input.id;
  const email = opts.input.email;

  if (id !== undefined) {
    return db.userCollection.findFirst((q) => q.where({ id })) ?? null;
  }

  if (email !== undefined) {
    return db.userCollection.findFirst((q) => q.where({ email })) ?? null;
  }

  return null;
});
