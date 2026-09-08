import invariant from 'tiny-invariant';
import type { FleetRequest, RequestSpan } from './types';

const HEALTH_PATH = '/health';
const PROBE_ROUTE = 'POST /api/rpc/user/getCurrentUser';
const PROBE_STATUS = 401;
const UNROUTED_NAME = /^HTTP [A-Z]+$/;

export function collectFleetRequests(spans: ReadonlyArray<RequestSpan>): Array<FleetRequest> {
  const requests: Array<FleetRequest> = [];

  for (const [traceID, traceSpans] of buildTraceGroups(spans)) {
    if (traceSpans.every((span) => isHealthCheck(span))) {
      continue;
    }

    if (traceSpans.some((span) => isVerifyProbe(span))) {
      continue;
    }

    requests.push({ route: pickRoute(traceSpans), traceID });
  }

  return requests;
}

function buildTraceGroups(
  spans: ReadonlyArray<RequestSpan>,
): ReadonlyMap<string, ReadonlyArray<RequestSpan>> {
  const traces = new Map<string, Array<RequestSpan>>();

  for (const span of spans) {
    const trace = traces.get(span.traceID);

    if (trace === undefined) {
      traces.set(span.traceID, [span]);
      continue;
    }

    trace.push(span);
  }

  return traces;
}

function isHealthCheck(span: RequestSpan): boolean {
  return span.path === HEALTH_PATH || span.name.endsWith(` ${HEALTH_PATH}`);
}

function isVerifyProbe(span: RequestSpan): boolean {
  return span.name === PROBE_ROUTE && span.statusCode === PROBE_STATUS;
}

// app-web emits a routed span (`POST /api/rpc/…`) beside an unrouted one (`HTTP POST`) that
// carries the path, and a service span is named by its wildcard route with the path alongside
function pickRoute(spans: ReadonlyArray<RequestSpan>): string {
  const routed = spans.find((span) => !UNROUTED_NAME.test(span.name) && !span.name.endsWith('*'));

  if (routed !== undefined) {
    return routed.name;
  }

  const withPath = spans.find((span) => span.path !== null);

  if (withPath !== undefined) {
    return `${withPath.service} ${withPath.path}`;
  }

  const [first] = spans;

  invariant(first, 'a trace group holds at least one span');

  return `${first.service} ${first.name}`;
}
