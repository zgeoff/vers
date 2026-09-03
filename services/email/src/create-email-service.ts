import { createEmailClient } from '@vers/email';
import type { JobQueue } from '@vers/jobs';
import { createService, reportUnexpectedError } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import invariant from 'tiny-invariant';
import { buildEmailRouter } from './build-router';
import { createEmailJobQueue } from './create-email-job-queue';
import type { EmailJobDefs } from './create-email-job-queue';
import { envShape } from './env-shape';

interface CreateEmailServiceConfig {
  readonly queueConnectionString?: string;
}

export interface EmailService {
  readonly queue: JobQueue<EmailJobDefs>;
  readonly service: Service<typeof envShape>;
}

export async function createEmailService(
  config: CreateEmailServiceConfig = {},
): Promise<EmailService> {
  let queue: JobQueue<EmailJobDefs> | undefined;

  const service = await createService({
    buildRouter: (runtime) => {
      queue = createEmailJobQueue({
        connectionString: config.queueConnectionString ?? runtime.env.DATABASE_URL,
        emailClient: createEmailClient({
          apiKey: runtime.env.RESEND_API_KEY,
          from: runtime.env.EMAIL_FROM,
        }),
        onError: (error) => {
          runtime.logger.error({ err: error }, 'email job queue error');

          reportUnexpectedError(error);
        },
        onJobFailed: (error, context) => {
          runtime.logger.error({ err: error, ...context }, 'email job failed');

          if (context.retriesExhausted) {
            reportUnexpectedError(error);
          }
        },
      });

      return buildEmailRouter({ logger: runtime.logger, queue });
    },
    envShape,
    name: 'service-email',
  });

  invariant(queue, 'buildRouter did not run before createService resolved');

  return { queue, service };
}
