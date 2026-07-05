export function getTokenFromHeader(header: null | string | undefined): null | string {
  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
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
