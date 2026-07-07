import type { CurrentUserResult } from './read-current-user-result';

/**
 * Selects the session-badge fragment's display text for a resolved session result. Split out from
 * the fragment's server function so the auth-state branch is reachable by a plain call, independent
 * of `getRequestHeaders`/`createCompositeComponent` — both require the live TanStack Start server
 * runtime and can't run under `bun test`.
 */
export function pickSessionBadgeMessage(result: CurrentUserResult): string {
  return result.authenticated
    ? `Flight fragment: signed in as ${result.user.name}.`
    : 'Flight fragment: no active session.';
}
