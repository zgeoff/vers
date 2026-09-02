export type Middleware = (request: Request, next: () => Promise<Response>) => Promise<Response>;

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
