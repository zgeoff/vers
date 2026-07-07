import { implement } from '@orpc/server';
import { userContract } from '@vers/contract-user';
import { userCollection } from '../db/user-collection';
import type { MockContext } from '../resolve-session-context';

export function buildMockUserRouter() {
  const os = implement(userContract).$context<MockContext>();

  return {
    changePassword: os.changePassword.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
    createPasswordResetToken: os.createPasswordResetToken.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
    createUser: os.createUser.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
    getCurrentUser: os.getCurrentUser.handler((opts) => {
      const { actingUserId } = opts.context;

      if (actingUserId === null) {
        throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
      }

      const user = userCollection.findFirst((q) => q.where({ id: actingUserId }));

      if (user === undefined) {
        throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
      }

      return user;
    }),
    getUser: os.getUser.handler((opts) => {
      const { id } = opts.input;
      const { email } = opts.input;

      if (id !== undefined) {
        return userCollection.findFirst((q) => q.where({ id })) ?? null;
      }

      if (email !== undefined) {
        return userCollection.findFirst((q) => q.where({ email })) ?? null;
      }

      return null;
    }),
    resetPassword: os.resetPassword.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
    updateEmail: os.updateEmail.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
    updateUser: os.updateUser.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
    verifyPassword: os.verifyPassword.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
  };
}
