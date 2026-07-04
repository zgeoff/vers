import { safe } from '@orpc/client';
import { createServerFn } from '@tanstack/react-start';
import type { UnauthorizedReason, User } from '@vers/contract-user';
import { orpcClient } from './orpc-client';

export type CurrentUserResult =
  | { authenticated: true; user: User }
  | { authenticated: false; reason: UnauthorizedReason | 'transport-error' };

/**
 * Server-function consumption path: the oRPC call happens on the Start server and the typed
 * error is folded into a plain result union, so nothing error-shaped has to survive the
 * server-function serialization boundary.
 */
export const readCurrentUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CurrentUserResult> => {
    const { error, data, isDefined } = await safe(orpcClient.getCurrentUser());
    if (error === null) return { authenticated: true, user: data };
    if (isDefined) return { authenticated: false, reason: error.data.reason };
    return { authenticated: false, reason: 'transport-error' };
  },
);
