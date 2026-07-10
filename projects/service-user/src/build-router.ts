import { implement } from '@orpc/server';
import { userContract } from '@vers/contract-user';
import type { DB } from '@vers/db';
import type { ServiceContext } from '@vers/service-runtime';
import type { Kysely } from 'kysely';
import { changePassword } from './handlers/change-password';
import { createPasswordResetToken } from './handlers/create-password-reset-token';
import { createUser } from './handlers/create-user';
import { getCurrentUser } from './handlers/get-current-user';
import { getUser } from './handlers/get-user';
import { resetPassword } from './handlers/reset-password';
import { updateEmail } from './handlers/update-email';
import { updateUser } from './handlers/update-user';
import { verifyPassword } from './handlers/verify-password';

interface BuildUserRouterDeps {
  readonly db: Kysely<DB>;
}

/**
 * Assembles the user service's oRPC router, closing each handler over the shared db client.
 */
export function buildUserRouter(deps: BuildUserRouterDeps) {
  const os = implement(userContract).$context<ServiceContext>();

  return {
    changePassword: os.changePassword.handler((opts) => changePassword(deps.db, opts)),
    createPasswordResetToken: os.createPasswordResetToken.handler((opts) =>
      createPasswordResetToken(deps.db, opts),
    ),
    createUser: os.createUser.handler((opts) => createUser(deps.db, opts)),
    getCurrentUser: os.getCurrentUser.handler((opts) => getCurrentUser(deps.db, opts)),
    getUser: os.getUser.handler((opts) => getUser(deps.db, opts)),
    resetPassword: os.resetPassword.handler((opts) => resetPassword(deps.db, opts)),
    updateEmail: os.updateEmail.handler((opts) => updateEmail(deps.db, opts)),
    updateUser: os.updateUser.handler((opts) => updateUser(deps.db, opts)),
    verifyPassword: os.verifyPassword.handler((opts) => verifyPassword(deps.db, opts)),
  };
}

export type UserRouter = ReturnType<typeof buildUserRouter>;
