interface RedirectSource {
  readonly pathname: string;
  readonly search: string;
}

export function getLoginPathWithRedirect(source: RedirectSource): string {
  const redirectTo = `${source.pathname}${source.search}`;

  const searchParams = new URLSearchParams({ redirect: redirectTo });

  return `/login?${searchParams.toString()}`;
}
