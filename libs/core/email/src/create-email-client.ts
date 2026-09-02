import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { Resend } from 'resend';

const DEFAULT_FROM = 'noreply@transactional.versidle.com';

export interface CreateEmailClientConfig {
  apiKey: string;
  from?: string;
}

export interface SendEmailInput {
  html: string;

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

export function createEmailClient(config: Readonly<CreateEmailClientConfig>): EmailClient {
  const resend = new Resend(config.apiKey);

  const from = config.from ?? DEFAULT_FROM;

  return {
    sendEmail: (input) => {
      const tracer = trace.getTracer('@vers/email');

      return tracer.startActiveSpan('resend.send', { kind: SpanKind.CLIENT }, async (span) => {
        try {
          const sendOptions =
            input.idempotencyKey === undefined
              ? undefined
              : { idempotencyKey: input.idempotencyKey };

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
            throw new Error(`failed to send email: ${result.error.message}`, {
              cause: result.error,
            });
          }

          return { id: result.data.id };
        } catch (error) {
          const exception = error instanceof Error ? error : String(error);

          span.recordException(exception);
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      });
    },
  };
}
