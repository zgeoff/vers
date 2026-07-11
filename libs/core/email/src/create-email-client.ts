import { Resend } from 'resend';

const DEFAULT_FROM = 'noreply@transactional.versidle.com';

export interface CreateEmailClientConfig {
  apiKey: string;
  from?: string;
}

export interface SendEmailInput {
  html: string;

  /**
   * Sent as the `Idempotency-Key` header, so a resend of the same key returns the original send
   * instead of delivering a duplicate — used by callers that retry a send after an ambiguous
   * failure.
   */
  idempotencyKey?: string;
  plainText: string;
  subject: string;
  to: string;
}

export interface SentEmail {
  id: string;
}

export interface EmailClient {
  readonly sendEmail: (input: Readonly<SendEmailInput>) => Promise<SentEmail>;
}

/**
 * Builds a Resend-backed email client. Configuration is passed in explicitly rather than read from
 * the environment — callers own env parsing.
 */
export function createEmailClient(config: Readonly<CreateEmailClientConfig>): EmailClient {
  const resend = new Resend(config.apiKey);

  const from = config.from ?? DEFAULT_FROM;

  return {
    sendEmail: async (input) => {
      const sendOptions =
        input.idempotencyKey === undefined ? undefined : { idempotencyKey: input.idempotencyKey };

      const result = await resend.emails.send(
        {
          from,
          html: input.html,
          subject: input.subject,
          text: input.plainText,
          to: input.to,
        },
        sendOptions,
      );

      if (result.error) {
        throw new Error(`failed to send email: ${result.error.message}`, { cause: result.error });
      }

      return { id: result.data.id };
    },
  };
}
