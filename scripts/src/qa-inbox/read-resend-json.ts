import { ResendRequestError } from './resend-request-error';

const RESEND_API_ORIGIN = 'https://api.resend.com';
const REQUEST_TIMEOUT_MS = 15_000;

interface RequestConfig {
  readonly deadline?: number;
}

export async function readResendJSON(
  apiKey: string,
  path: string,
  config: RequestConfig = {},
): Promise<unknown> {
  const remainingMS =
    config.deadline === undefined ? REQUEST_TIMEOUT_MS : config.deadline - Date.now();

  const timeoutMS = Math.max(1, Math.min(REQUEST_TIMEOUT_MS, remainingMS));

  const response = await fetch(`${RESEND_API_ORIGIN}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(timeoutMS),
  });

  if (!response.ok) {
    const detail = await response.text();

    throw new ResendRequestError(path, response.status, detail);
  }

  return response.json();
}
