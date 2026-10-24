import { NeonRequestError } from './neon-request-error';

export const NEON_API_ORIGIN = 'https://console.neon.tech/api/v2';
const REQUEST_TIMEOUT_MS = 30_000;

interface NeonRequest {
  readonly apiKey: string;
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly body?: unknown;
}

export async function requestNeonJSON(request: NeonRequest): Promise<unknown> {
  const response = await fetch(`${NEON_API_ORIGIN}${request.path}`, {
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${request.apiKey}`,
      'Content-Type': 'application/json',
    },
    method: request.method,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text();

    throw new NeonRequestError(request.method, request.path, response.status, detail);
  }

  const payload: unknown = await response.json();

  return payload;
}
