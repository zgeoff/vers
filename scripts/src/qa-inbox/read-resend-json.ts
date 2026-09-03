import { ResendRequestError } from './resend-request-error';

const RESEND_API_ORIGIN = 'https://api.resend.com';
const REQUEST_TIMEOUT_MS = 15_000;

export async function readResendJSON(apiKey: string, path: string): Promise<unknown> {
  const response = await fetch(`${RESEND_API_ORIGIN}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text();

    throw new ResendRequestError(path, response.status, detail);
  }

  return response.json();
}
