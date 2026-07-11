export function getTokenFromHeader(header: null | string | undefined): null | string {
  if (header === null || header === undefined || header.length === 0) {
    return null;
  }

  const headerParts = header.split(/\s+/);

  if (headerParts.length !== 2) {
    return null;
  }

  const [, token] = headerParts;

  return token ?? null;
}
