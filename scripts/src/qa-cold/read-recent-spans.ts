import { parseAxiomSpans } from './parse-axiom-spans';
import type { RequestSpan } from './types';

const AXIOM_QUERY_URL = 'https://api.axiom.co/v1/datasets/_apl?format=legacy';
const REQUEST_TIMEOUT_MS = 30_000;
const SPAN_LIMIT = 50_000;

const SERVER_SPANS_APL = [
  "['vers-traces']",
  'where kind == "server"',
  "project trace_id, ['service.name'], name, ['attributes.url.path'], ['attributes.http.response.status_code']",
  `limit ${SPAN_LIMIT}`,
].join(' | ');

export async function readRecentSpans(
  token: string,
  windowMinutes: number,
): Promise<Array<RequestSpan>> {
  const response = await fetch(AXIOM_QUERY_URL, {
    body: JSON.stringify({
      apl: SERVER_SPANS_APL,
      endTime: 'now',
      startTime: `now-${windowMinutes}m`,
    }),
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    method: 'POST',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(`Axiom query failed with ${response.status}: ${detail}`);
  }

  const json: unknown = await response.json();

  const spans = parseAxiomSpans(json);

  if (spans.length >= SPAN_LIMIT) {
    throw new Error(
      `Axiom returned ${spans.length} spans, the query limit, so the window may hold requests the guard did not see`,
    );
  }

  return spans;
}
