import { createId } from '@paralleldrive/cuid2';
import * as db from '../../db';
import { os } from './os';

export const createUser = os.createUser.handler((opts) => {
  if (db.userCollection.findFirst((q) => q.where({ email: opts.input.email })) !== undefined) {
    throw opts.errors.CONFLICT({ data: { field: 'email' } });
  }

  if (
    db.userCollection.findFirst((q) => q.where({ username: opts.input.username })) !== undefined
  ) {
    throw opts.errors.CONFLICT({ data: { field: 'username' } });
  }

  const now = new Date();

  return db.userCollection.create({
    createdAt: now,
    email: opts.input.email,
    id: createId(),
    name: opts.input.name,
    password: opts.input.password,
    seed: 0,
    updatedAt: now,
    username: opts.input.username,
  });
});
