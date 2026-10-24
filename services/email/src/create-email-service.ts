import { createEmailClient } from '@vers/email';
import { JOB_QUEUE_STOP_TIMEOUT_MS } from '@vers/jobs';
import type { JobQueue } from '@vers/jobs';
import { createService, reportUnexpectedError } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import invariant from 'tiny-invariant';
import { buildEmailRouter } from './build-router';
import { createBackgroundDrains } from './create-background-drains';
import { createEmailJobQueue } from './create-email-job-queue';
import type { EmailJobPayloads } from './create-email-job-queue';
import { envShape } from './env-shape';

interface CreateEmailServiceConfig {
  readonly queueConnectionString?: string;
}

export interface EmailService {
  readonly queue: JobQueue<EmailJobPayloads>;
  readonly service: Service<typeof envShape>;
}

export async function createEmailService(
  config: CreateEmailServiceConfig = {},
): Promise<EmailService> {
  const drains = createBackgroundDrains();
  let queue: JobQueue<EmailJobPayloads> | undefined;

  const service = await createService({
    allowedIssuers: ['app-web'],
    createRouter: (runtime) => {
      queue = createEmailJobQueue({
        connectionString: config.queueConnectionString ?? runtime.env.DATABASE_URL,
        emailClient: createEmailClient({
          apiKey: runtime.env.RESEND_API_KEY,
          from: runtime.env.EMAIL_FROM,
        }),
        logger: runtime.logger,
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

      return buildEmailRouter({ drains, logger: runtime.logger, queue });
    },
    envShape,
    name: 'service-email',
  });

  invariant(queue, 'createRouter did not run before createService resolved');

  const jobQueue = queue;

  return {
    queue: {
      ...jobQueue,
      stop: async () => {
        await drains.stop(JOB_QUEUE_STOP_TIMEOUT_MS);
        await jobQueue.stop();
      },
    },
    service,
  };
}
