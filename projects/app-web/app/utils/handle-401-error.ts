import { getLoginPathWithRedirect } from './get-login-path-with-redirect.server';
import { isURQLFetchError } from './is-urql-fetch-error.server';
import { logout } from './logout.server';

/**
 * Handles a 401 error by logging the user out and redirecting to the login page.
 *
 * As manually check the token's expiry on authed routes and proactively refresh
 * if needed, we can keep this flow simple when we encounter a 401.
 *
 * @param request - The request object.
 * @param error - The error object.
 */
export async function handle401Error(request: Request, error: unknown) {
  if (isURQLFetchError(error) && error.response.status === 401) {
    const redirectTo = getLoginPathWithRedirect(request);

    await logout(request, { redirectTo });
  }
}
