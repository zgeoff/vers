import { WringerError } from '@wringer/core';
import type { HttpClient } from '@wringer/http';
import { z } from 'zod';
import { findEmailCode } from './find-email-code';

const capturedEmailSchema = z.object({ subject: z.string(), html: z.string(), text: z.string() });
const capturedEmailsSchema = z.object({ emails: z.array(capturedEmailSchema) });
const pollMs = 250;
const waitMs = 20_000;

// The email service sends from a job queue, so the stub captures the mail a moment after the page
// moves on; this polls until the last mail to the address carries a code.
export async function readLastEmail(
  client: HttpClient,
  to: string,
  signal: AbortSignal,
): Promise<{ subject: string; code: string }> {
  const deadline = Date.now() + waitMs;

  while (Date.now() < deadline && !signal.aborted) {
    const response = await client.request({
      method: 'GET',
      path: `/emails?to=${encodeURIComponent(to)}`,
      evidence: false,
    });

    const captured = capturedEmailsSchema.parse(response.json);
    const found = findEmailCode(captured.emails);

    if (found !== null) {
      return found;
    }

    await Bun.sleep(pollMs);
  }

  throw new WringerError('check-failed', {
    message: `The Resend stub captured no email with a code for ${to} within ${waitMs} ms.`,
    hint: 'Check the address, and that the form moved on to the code step.',
  });
}
