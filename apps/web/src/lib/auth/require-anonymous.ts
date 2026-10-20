import { redirect } from '@tanstack/react-router';
import { readAuthSession } from './read-auth-session';

export async function requireAnonymous(): Promise<void> {
  const session = await readAuthSession();

  if (session.sessionID !== undefined) {
    throw redirect({ href: '/' });
  }
}
