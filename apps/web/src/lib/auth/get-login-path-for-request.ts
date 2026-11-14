import { getLoginPathWithRedirect } from './get-login-path-with-redirect';

// TanStack Start's default base for server function calls
const serverFunctionPrefix = '/_serverFn/';

// The login path for a request that lost its session. A server function call's own URL is no page
// to come back to, so its redirect names the page that made the call, read from a same-origin
// Referer, or no page at all.
export function getLoginPathForRequest(requestURL: URL, referer: string | undefined): string {
  if (!requestURL.pathname.startsWith(serverFunctionPrefix)) {
    return getLoginPathWithRedirect(requestURL);
  }

  const page = URL.parse(referer ?? '');

  if (
    page === null ||
    page.origin !== requestURL.origin ||
    page.pathname.startsWith(serverFunctionPrefix)
  ) {
    return '/login';
  }

  return getLoginPathWithRedirect(page);
}
