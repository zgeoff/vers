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

export const sentEmails = new Map<string, CapturedEmail>();

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
