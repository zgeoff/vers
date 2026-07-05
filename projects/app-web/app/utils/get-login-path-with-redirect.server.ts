import { Routes } from '~/types';

/**
 * Returns the login route path with the redirect query param set to the current URL.
 */
export function getLoginPathWithRedirect(request: Request) {
  const url = new URL(request.url);

  const loginRedirect = `${url.pathname.replace('.data', '')}?${url.searchParams.toString()}`;

  const searchParams = new URLSearchParams({ redirect: loginRedirect });

  const loginWithRedirectPath = `${Routes.Login}?${searchParams.toString()}`;

  return loginWithRedirectPath;
}
