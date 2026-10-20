import { isDefinedError, safe } from '@orpc/client';
import type { UserData } from '@vers/contract-user';
import { readAuthSession } from '../auth/read-auth-session';
import { userClient } from '../rpc/clients/user-client';

export async function readCurrentUser(): Promise<UserData | null> {
  const session = await readAuthSession();

  if (
    session.accessToken === undefined ||
    session.sessionID === undefined ||
    session.userID === undefined
  ) {
    return null;
  }

  const [error, data, isDefined] = await safe(userClient.getCurrentUser({}));

  if (error === null) {
    return data;
  }

  if (isDefined && isDefinedError(error) && error.code === 'UNAUTHORIZED') {
    return null;
  }

  throw error;
}
