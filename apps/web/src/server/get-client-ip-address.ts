// srvx sets `ip` on the request from the underlying socket on Node
interface RequestWithIP extends Request {
  readonly ip?: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- RequestWithIP extends the built-in Request, which carries mutating methods (e.g. clone()) no readonly form can cover
export function getClientIPAddress(request: RequestWithIP): string {
  return (
    request.headers.get('fly-client-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.ip ??
    ''
  );
}
