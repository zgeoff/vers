import { isDefinedError, safe } from '@orpc/client';
import type { UnauthorizedReason } from '@vers/contract-base';
import type { UserData } from '@vers/contract-user';
import { userClient } from '../rpc/clients/user-client';

/**
 * The index route's auth-state read, folded into a plain result union — never a thrown error.
 */
export type CurrentUserResult =
  | { readonly authenticated: false; readonly reason: 'transport-error' | UnauthorizedReason }
  | { readonly authenticated: true; readonly user: UserData };

/**
 * Calls the user service's `getCurrentUser` for the ambient caller and folds its typed
 * `UNAUTHORIZED` error into a plain result union, so the index server component never has to
 * branch on a thrown error.
 */
export async function tryReadCurrentUser(): Promise<CurrentUserResult> {
  const [error, data, isDefined] = await safe(userClient.getCurrentUser({}));

  if (error === null) {
    return { authenticated: true, user: data };
  }

  if (isDefined && isDefinedError(error)) {
    return { authenticated: false, reason: error.data.reason };
  }

  return { authenticated: false, reason: 'transport-error' };
}
