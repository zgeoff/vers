import { bytesToHex } from '@noble/hashes/utils.js';
import type { TraceContext } from './types';

export function createTraceContext(parent?: Readonly<TraceContext>): TraceContext {
  return {
    spanID: bytesToHex(crypto.getRandomValues(new Uint8Array(8))),
    traceID: parent?.traceID ?? bytesToHex(crypto.getRandomValues(new Uint8Array(16))),
  };
}
