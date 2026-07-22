import { isDefinedError, safe } from '@orpc/client';
import type { UserData } from '@vers/contract-user';
import { getAuthSession } from '../auth/get-auth-session';
import { userClient } from '../rpc/clients/user-client';

/**
 * Reads the caller's current user for the landing page. A cookie with no `accessToken`,
 * `sessionID`, or `userID` resolves `null` with no call to the user service at all, so an
 * anonymous visitor's landing page never depends on the user or session services being reachable.
 * A cookie present but the service answering the declared `UNAUTHORIZED` (a revoked or expired
 * session) also resolves `null`; every other failure throws, so a newly declared contract error
 * can never silently degrade into "anonymous".
 */
export async function readCurrentUser(): Promise<UserData | null> {
  const session = await getAuthSession();

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
