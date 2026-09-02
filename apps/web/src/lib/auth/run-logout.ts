import { redirect } from '@tanstack/react-router';
import { logger } from '../../server/logger';
import { sessionClient } from '../rpc/clients/session-client';
import { getAuthSession } from './get-auth-session';
import { removeAuthSession } from './remove-auth-session';
import { toSafeRedirectPath } from './to-safe-redirect-path';

interface LogoutOptions {
  readonly deleteSession?: boolean;
  readonly redirectTo?: string;
}

export async function runLogout(options: LogoutOptions = {}): Promise<never> {
  const session = await getAuthSession();

  if (options.deleteSession === true && session.sessionID !== undefined) {
    const sessionID = session.sessionID;
    const actingUserID = session.userID ?? null;

    await sessionClient
      .deleteSession({ id: sessionID }, { context: { actingUserID } })
      .catch((error: unknown) => {
        logger.warn({ err: error }, 'session delete during logout failed');
      });
  }

  await removeAuthSession();

  throw redirect({ href: toSafeRedirectPath(options.redirectTo, '/') });
}
