/** The part of a URL {@link getLoginPathWithRedirect} needs to rebuild the page a guard bounced. */
interface RedirectSource {
  readonly pathname: string;
  readonly search: string;
}

/** Builds `/login?redirect=<page>`, so a completed login returns the caller to where it left off. */
export function getLoginPathWithRedirect(source: RedirectSource): string {
  const redirectTo = `${source.pathname}${source.search}`;

  const searchParams = new URLSearchParams({ redirect: redirectTo });

  return `/login?${searchParams.toString()}`;
}
