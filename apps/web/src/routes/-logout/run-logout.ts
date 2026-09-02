import { runLogout as runSessionLogout } from '../../lib/auth/run-logout';

export async function runLogout(): Promise<Response> {
  try {
    await runSessionLogout({ deleteSession: true });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    throw error;
  }

  throw new Error('unreachable: session logout always throws a redirect');
}
