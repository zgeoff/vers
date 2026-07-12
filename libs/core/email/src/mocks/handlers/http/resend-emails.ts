import { HttpResponse, http } from 'msw';
import type { HttpResponseResolver } from 'msw';
import * as z from 'zod';

export const ENDPOINT_URL = `https://api.resend.com/emails`;

const ResendEmailBodySchema = z.object({
  from: z.string(),
  html: z.string(),
  subject: z.string(),
  text: z.string(),
  to: z.string(),
});

export interface CapturedEmail {
  readonly from: string;
  readonly html: string;
  readonly idempotencyKey: null | string;
  readonly plainText: string;
  readonly subject: string;
  readonly to: string;
}

/**
 * Every delivery the default resend handler accepted, keyed by recipient. Each consuming
 * package's preload clears it between tests. The map keeps only the last send per recipient, so
 * a test asserting delivery count wraps the resolver in a spy instead.
 */
export const sentEmails = new Map<string, CapturedEmail>();

/**
 * Exported apart from the handler so a test can re-register a spy-wrapped copy and inspect the
 * raw request — call counts, headers — while keeping the capture behaviour.
 */
export async function resolveResendEmails(
  info: Parameters<HttpResponseResolver>[0],
): Promise<Response> {
  const requestBody = await info.request.json();

  const body = ResendEmailBodySchema.parse(requestBody);

  sentEmails.set(body.to, {
    from: body.from,
    html: body.html,
    idempotencyKey: info.request.headers.get('Idempotency-Key'),
    plainText: body.text,
    subject: body.subject,
    to: body.to,
  });

  return HttpResponse.json({ id: 'mock-email-id' });
}

export const resendEmails = http.post(ENDPOINT_URL, (info) => resolveResendEmails(info));
