export interface MintedTraceparent {
  readonly traceID: string;
  readonly traceparent: string;
}

/**
 * Mints a fresh W3C `traceparent` for one outbound submission call, returning its trace id
 * alongside so a failure report can carry the same id the service logs and reports under.
 * Inlined rather than imported from `@vers/service-utils` so the worker bundle never pulls that
 * package's server-only imports; the format is the wire contract both sides share.
 */
export function createTraceparent(): MintedTraceparent {
  const traceID = toRandomHex(16);

  return { traceID, traceparent: `00-${traceID}-${toRandomHex(8)}-01` };
}

function toRandomHex(byteCount: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteCount));

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
