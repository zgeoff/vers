import { bytesToHex } from '@noble/hashes/utils.js';
import type { TraceContext } from './types';

/**
 * Mints this hop's trace context: a fresh span id always, continuing the parent's trace id when
 * one is given and starting a new trace otherwise.
 */
export function createTraceContext(parent?: Readonly<TraceContext>): TraceContext {
  return {
    spanID: bytesToHex(crypto.getRandomValues(new Uint8Array(8))),
    traceID: parent?.traceID ?? bytesToHex(crypto.getRandomValues(new Uint8Array(16))),
  };
}
