import type { CreateUserPayload } from '@vers/service-types';
import { db } from '../../../db';
import { trpc } from './trpc';

export const createUser = trpc.createUser.mutation((opts) => {
  const user = db.user.create({
    email: opts.input.email,
    name: opts.input.name,
    username: opts.input.username,
  });

  return user as CreateUserPayload;
});
