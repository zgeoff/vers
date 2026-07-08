/**
 * A `Request` carrying the runtime's best-effort peer address, when the runtime exposes one (srvx
 * sets this from the underlying socket on Node).
 */
export interface RequestWithIP extends Request {
  readonly ip?: string;
}

/**
 * Reads the client's address off a request, preferring Fly's edge-set header, falling back to a
 * generic forwarding header, then the runtime-reported socket peer, and finally an empty string —
 * there's no case where a missing address should fail the request outright.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- RequestWithIP extends the built-in Request, which carries mutating methods (e.g. clone()) no readonly form can cover
export function getClientIPAddress(request: RequestWithIP): string {
  return (
    request.headers.get('fly-client-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.ip ??
    ''
  );
}
