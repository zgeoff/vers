// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function getDomainURL(request: Request) {
  const host =
    request.headers.get('X-Forwarded-Host') ??
    request.headers.get('host') ??
    new URL(request.url).host;

  const protocol = request.headers.get('X-Forwarded-Proto') ?? 'http';

  return `${protocol}://${host}`;
}
