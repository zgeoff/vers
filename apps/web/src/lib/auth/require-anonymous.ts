import { redirect } from '@tanstack/react-router';
import { getAuthSession } from './get-auth-session';

export async function requireAnonymous(): Promise<void> {
  const session = await getAuthSession();

  if (session.sessionID !== undefined) {
    throw redirect({ href: '/' });
  }
}
