/**
 * A single link in the request middleware chain: inspect or short-circuit `request`, or call
 * `next` to continue and optionally observe/replace the resulting response.
 */
export type Middleware = (request: Request, next: () => Promise<Response>) => Promise<Response>;

/**
 * Composes middleware into one handler, applied outermost-first (`middlewares[0]` sees the
 * request before anything else and the final response last), terminating in `handler`.
 */
export function withMiddleware(
  middlewares: ReadonlyArray<Middleware>,
  handler: (request: Request) => Promise<Response> | Response,
): (request: Request) => Promise<Response> {
  return (request) =>
    middlewares.reduceRight<() => Promise<Response>>(
      (next, middleware) => () => middleware(request, next),
      () => Promise.resolve(handler(request)),
    )();
}
