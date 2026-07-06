/** Renders a procedure's dot-path segments as the URL path oRPC's RPC protocol sends them on. */
export function toRPCHTTPPath(path: ReadonlyArray<string>): string {
  return `/${path.map((segment) => encodeURIComponent(segment)).join('/')}`;
}
