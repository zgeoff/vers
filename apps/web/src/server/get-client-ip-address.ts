// srvx sets `ip` on the request from the underlying socket on Node
interface RequestWithIP extends Request {
  readonly ip?: string;
}

export function getClientIPAddress(request: RequestWithIP): string {
  return (
    request.headers.get('fly-client-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.ip ??
    ''
  );
}
