import type { TraceContext } from './types';

/**
 * Mints this hop's trace context: a fresh span id always, continuing the parent's trace id when
 * one is given and starting a new trace otherwise.
 */
export function createTraceContext(parent?: Readonly<TraceContext>): TraceContext {
  return {
    spanID: toHex(crypto.getRandomValues(new Uint8Array(8))),
    traceID: parent?.traceID ?? toHex(crypto.getRandomValues(new Uint8Array(16))),
  };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
