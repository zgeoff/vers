import { TRPCError } from '@trpc/server';
import type { SendEmailPayload } from '@vers/service-types';
import { Resend } from 'resend';
import { z } from 'zod';
import { env } from '../env';
import { logger } from '../logger';
import { t } from '../t';
import type { Context } from '../types';

const resend = new Resend(env.RESEND_API_KEY);

export const SendEmailInputSchema = z.object({
  html: z.string(),
  plainText: z.string(),
  subject: z.string(),
  to: z.string().email(),
});

export async function sendEmail(
  input: z.infer<typeof SendEmailInputSchema>,
  _ctx: Context,
): Promise<SendEmailPayload> {
  try {
    const { html, plainText, subject, to } = input;

    const result = await resend.emails.send({
      from: 'noreply@transactional.versidle.com',
      html,
      subject,
      text: plainText,
      to,
    });

    if (result.error) {
      logger.error(result.error, 'failed to send email with resend:');

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to send email',
      });
    }

    return {};
  } catch (error: unknown) {
    logger.error(error, 'unknown error');

    if (error instanceof TRPCError) {
      throw error;
    }

    throw new TRPCError({
      cause: error,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unknown error occurred',
    });
  }
}

export const procedure = t.procedure
  .input(SendEmailInputSchema)
  .mutation((opts) => sendEmail(opts.input, opts.ctx));
