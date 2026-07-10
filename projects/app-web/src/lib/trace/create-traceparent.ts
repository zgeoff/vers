/**
 * Mints a fresh W3C `traceparent` for one browser-initiated call. Inlined rather than imported
 * from `@vers/service-utils` so the client bundle never pulls that package's server-only imports;
 * the format is the wire contract both sides share.
 */
export function createTraceparent(): string {
  return `00-${toRandomHex(16)}-${toRandomHex(8)}-01`;
}

function toRandomHex(byteCount: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteCount));

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
