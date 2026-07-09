/**
 * Redirects any path (other than the root) with a trailing slash to its slash-free form,
 * preserving the query string.
 */
export function removeTrailingSlash(
  request: Request,
  next: () => Promise<Response>,
): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);

    return Promise.resolve(Response.redirect(url.toString(), 302));
  }

  return next();
}
