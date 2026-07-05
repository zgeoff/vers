import { Resend } from 'resend';

const DEFAULT_FROM = 'noreply@transactional.versidle.com';

export interface CreateEmailClientConfig {
  apiKey: string;
  from?: string;
}

export interface SendEmailInput {
  html: string;
  plainText: string;
  subject: string;
  to: string;
}

export interface SentEmail {
  id: string;
}

export interface EmailClient {
  sendEmail: (input: Readonly<SendEmailInput>) => Promise<SentEmail>;
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
      const { html, plainText, subject, to } = input;

      const result = await resend.emails.send({ from, html, subject, text: plainText, to });

      if (result.error) {
        throw new Error(`failed to send email: ${result.error.message}`, { cause: result.error });
      }

      if (!result.data) {
        throw new Error('resend returned no data and no error');
      }

      return { id: result.data.id };
    },
  };
}
