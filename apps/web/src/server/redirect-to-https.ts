/**
 * Redirects a request the edge proxy forwarded over plain HTTP to its HTTPS equivalent, per the
 * `X-Forwarded-Proto` header the proxy sets.
 */
export function redirectToHTTPS(
  request: Request,
  next: () => Promise<Response>,
): Promise<Response> {
  const proto = request.headers.get('x-forwarded-proto');

  if (proto === 'http') {
    const url = new URL(request.url);

    url.protocol = 'https:';

    return Promise.resolve(Response.redirect(url.toString(), 301));
  }

  return next();
}
