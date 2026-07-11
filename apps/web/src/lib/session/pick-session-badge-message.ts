import type { CurrentUserResult } from './try-read-current-user';

export function pickSessionBadgeMessage(result: CurrentUserResult): string {
  return result.authenticated
    ? `Flight fragment: signed in as ${result.user.name}.`
    : 'Flight fragment: no active session.';
}
