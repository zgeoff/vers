import type { ServiceName } from '@vers/service-auth';

// the edge's QA route calls these behind its own token gate, so a browser never reaches them
const EDGE_ONLY_PROCEDURES: Readonly<Partial<Record<ServiceName, ReadonlySet<string>>>> = {
  activity: new Set(['createQAAccount']),
};

export function isProxiedProcedure(service: ServiceName, path: ReadonlyArray<string>): boolean {
  const edgeOnly = EDGE_ONLY_PROCEDURES[service];

  if (edgeOnly === undefined) {
    return true;
  }

  return path.every((segment) => {
    const decoded = decodeSegment(segment);

    return decoded !== null && !edgeOnly.has(decoded);
  });
}

// a malformed escape names no procedure, so refusing it costs a browser nothing
function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}
