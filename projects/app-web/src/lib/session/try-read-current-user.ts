import { isDefinedError, safe } from '@orpc/client';
import type { UnauthorizedReason } from '@vers/contract-base';
import type { UserData } from '@vers/contract-user';
import { userClient } from '../rpc/clients/user-client';

/** The index route's auth-state read, folded into a plain result union — never a thrown error. */
export type CurrentUserResult =
  | { readonly authenticated: false; readonly reason: 'transport-error' | UnauthorizedReason }
  | { readonly authenticated: true; readonly user: UserData };

/**
 * Calls the user service's `getCurrentUser` with the caller's forwarded session headers and folds
 * its typed `UNAUTHORIZED` error into a plain result union, so the index server component never
 * has to branch on a thrown error. Headers are the caller's own concern (read from the live
 * request in production, supplied directly in tests) — this function stays a plain async call.
 */
export async function tryReadCurrentUser(
  headers: Readonly<Record<string, string>>,
): Promise<CurrentUserResult> {
  const { data, error, isDefined } = await safe(
    userClient.getCurrentUser({}, { context: { headers } }),
  );

  if (error === null) {
    return { authenticated: true, user: data };
  }

  if (isDefined && isDefinedError(error)) {
    return { authenticated: false, reason: error.data.reason };
  }

  return { authenticated: false, reason: 'transport-error' };
}
