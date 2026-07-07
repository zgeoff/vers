import { redirect } from '@tanstack/react-router';
import { getAuthSession } from './get-auth-session';

/** Gates a route to signed-out callers, bouncing an already-signed-in caller back home. */
export async function requireAnonymous(): Promise<void> {
  const session = await getAuthSession();

  if (session.sessionID !== undefined) {
    throw redirect({ href: '/' });
  }
}
