export function toRPCHTTPPath(path: ReadonlyArray<string>): string {
  return `/${path.map((segment) => encodeURIComponent(segment)).join('/')}`;
}
