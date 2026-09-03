import { ResendRequestError } from './resend-request-error';

const RESEND_API_ORIGIN = 'https://api.resend.com';

export async function readResendJSON(apiKey: string, path: string): Promise<unknown> {
  const response = await fetch(`${RESEND_API_ORIGIN}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    const detail = await response.text();

    throw new ResendRequestError(path, response.status, detail);
  }

  return response.json();
}
