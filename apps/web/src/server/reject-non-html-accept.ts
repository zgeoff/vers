const PASSTHROUGH_PREFIXES = ['/api/', '/_serverFn/'] as const;
const PASSTHROUGH_PATHS = ['/health'] as const;
const HTML_ACCEPT_TYPES = ['*/*', 'text/html'] as const;

export function rejectNonHTMLAccept(
  request: Request,
  next: () => Promise<Response>,
): Promise<Response> {
  const pathname = new URL(request.url).pathname;

  if (
    PASSTHROUGH_PATHS.some((path) => pathname === path) ||
    PASSTHROUGH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return next();
  }

  if (hasHTMLAccept(request)) {
    return next();
  }

  return Promise.resolve(
    new Response('Not Acceptable: this path serves text/html', {
      headers: { 'content-type': 'text/plain; charset=utf-8', vary: 'accept' },
      status: 406,
    }),
  );
}

// the same parse TanStack Start applies before it renders a route, so every request this gate
// passes is one Start renders rather than refuses
function hasHTMLAccept(request: Request): boolean {
  const accept = request.headers.get('accept');
  const acceptParts = (accept === null || accept === '' ? '*/*' : accept).split(',');

  return HTML_ACCEPT_TYPES.some((mimeType) =>
    acceptParts.some((part) => part.trim().startsWith(mimeType)),
  );
}
