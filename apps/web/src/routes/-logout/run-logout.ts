import { runLogout as runSessionLogout } from '../../lib/auth/run-logout';

/**
 * Adapts the always-throwing session logout into the `Response` a route's raw HTTP handler must
 * return.
 */
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
