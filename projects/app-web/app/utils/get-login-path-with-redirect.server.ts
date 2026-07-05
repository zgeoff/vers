import { Routes } from '../types';

/**
 * Returns the login route path with the redirect query param set to the current URL.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function getLoginPathWithRedirect(request: Request) {
  const url = new URL(request.url);

  const loginRedirect = `${url.pathname.replace('.data', '')}?${url.searchParams.toString()}`;

  const searchParams = new URLSearchParams({ redirect: loginRedirect });

  const loginWithRedirectPath = `${Routes.Login}?${searchParams.toString()}`;

  return loginWithRedirectPath;
}
