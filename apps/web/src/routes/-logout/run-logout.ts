import { logout } from '../../lib/auth/logout';

/**
 * Adapts the always-throwing `logout` into the `Response` a route's raw HTTP handler must return.
 */
export async function runLogout(): Promise<Response> {
  try {
    await logout({ deleteSession: true });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    throw error;
  }

  throw new Error('unreachable: logout always throws a redirect');
}
