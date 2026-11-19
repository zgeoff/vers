import { WringerError } from '@wringer/core';
import { z } from 'zod';
import { findEmailCode } from './find-email-code';

const capturedEmailSchema = z.object({ subject: z.string(), html: z.string(), text: z.string() });
const capturedEmailsSchema = z.object({ emails: z.array(capturedEmailSchema) });
const pollMs = 250;
const waitMs = 20_000;

// The email service sends from a job queue, so the stub captures the mail a moment after the page
// moves on; this polls until the last mail to the address carries a code. It calls the stub itself,
// because the run's http driver points at the web app.
export async function readLastEmail(
  resendURL: string,
  to: string,
  signal: AbortSignal,
): Promise<{ subject: string; code: string }> {
  const deadline = Date.now() + waitMs;

  while (Date.now() < deadline && !signal.aborted) {
    const response = await fetch(new URL(`/emails?to=${encodeURIComponent(to)}`, resendURL), {
      signal,
    });

    const body: unknown = await response.json();

    const captured = capturedEmailsSchema.parse(body);
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
