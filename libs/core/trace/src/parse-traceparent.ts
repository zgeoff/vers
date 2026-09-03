import type { TraceContext } from './types';

const TRACEPARENT_PATTERN =
  /^(?<version>[0-9a-f]{2})-(?<traceID>[0-9a-f]{32})-(?<spanID>[0-9a-f]{16})-[0-9a-f]{2}$/;

export function parseTraceparent(header: null | string): TraceContext | null {
  if (header === null) {
    return null;
  }

  const groups = TRACEPARENT_PATTERN.exec(header.trim())?.groups;

  if (groups?.['version'] === undefined) {
    return null;
  }

  const version = groups['version'];
  const traceID = groups['traceID'] ?? '';
  const spanID = groups['spanID'] ?? '';

  if (version === 'ff' || !/[1-9a-f]/.test(traceID) || !/[1-9a-f]/.test(spanID)) {
    return null;
  }

  return { spanID, traceID };
}
