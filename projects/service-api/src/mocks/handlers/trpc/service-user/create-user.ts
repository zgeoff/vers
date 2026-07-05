import type { CreateUserPayload } from '@vers/service-types';
import { db } from '../../../db';
import { trpc } from './trpc';

export const createUser = trpc.createUser.mutation(({ input }) => {
  const user = db.user.create({
    email: input.email,
    name: input.name,
    username: input.username,
  });

  return user as CreateUserPayload;
});
