import { implement } from '@orpc/server';
import { userContract, type User } from '@vers/contract-user';
import type { ServiceContext } from './types';

const os = implement(userContract).$context<ServiceContext>();

/** Spike-grade user store: the single user the hard-coded valid session token resolves to. */
const USERS: Record<string, User> = {
  'user-1': {
    id: 'user-1',
    email: 'geoff@example.com',
    displayName: 'Geoff',
  },
};

const getCurrentUser = os.getCurrentUser.handler(({ context, errors }) => {
  if ('failure' in context.session) {
    throw errors.UNAUTHORIZED({ data: { reason: context.session.failure } });
  }
  const user = USERS[context.session.userId];
  if (user === undefined) {
    throw errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }
  return user;
});

/** Implementation router for the user contract; the shape is enforced against the contract. */
export const userRouter = os.router({
  getCurrentUser,
});
