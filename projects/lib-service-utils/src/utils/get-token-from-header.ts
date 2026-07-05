export function getTokenFromHeader(header: null | string | undefined): null | string {
  if (!header) {
    return null;
  }

  const headerParts = header.split(/\s+/);

  if (headerParts.length !== 2) {
    return null;
  }

  const [, token] = headerParts;

  return token ?? null;
}
