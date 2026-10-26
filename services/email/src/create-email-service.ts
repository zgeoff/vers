import { createEmailClient } from '@vers/email';
import { JOB_QUEUE_STOP_TIMEOUT_MS } from '@vers/jobs';
import type { JobQueue } from '@vers/jobs';
import { createService, reportUnexpectedError } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import { buildEmailRouter } from './build-router';
import { createBackgroundDrains } from './create-background-drains';
import type { BackgroundDrains } from './create-background-drains';
import { createEmailJobQueue } from './create-email-job-queue';
import type { EmailJobPayloads } from './create-email-job-queue';
import { envShape } from './env-shape';

interface CreateEmailServiceConfig {
  readonly queueConnectionString?: string;
}

interface EmailResources {
  readonly drains: BackgroundDrains;
  readonly queue: JobQueue<EmailJobPayloads>;
}

export type EmailService = Service<typeof envShape, EmailResources>;

export function createEmailService(config: CreateEmailServiceConfig = {}): Promise<EmailService> {
  return createService({
    allowedIssuers: ['app-web'],
    createRouter: (runtime, resources) =>
      buildEmailRouter({
        drains: resources.drains,
        logger: runtime.logger,
        queue: resources.queue,
      }),
    envShape,
    name: 'service-email',
    onBoot: (resources) => resources.queue.drain(),
    resources: async (runtime, scope) => {
      const drains = createBackgroundDrains();

      const queue = createEmailJobQueue({
        connectionString: config.queueConnectionString ?? runtime.env.DATABASE_URL,
        emailClient: createEmailClient({
          apiKey: runtime.env.RESEND_API_KEY,
          from: runtime.env.EMAIL_FROM,
        }),
        logger: runtime.logger,
        onError: (error) => {
          runtime.logger.error('email job queue error', { error });

          reportUnexpectedError(error);
        },
        onJobFailed: (error, context) => {
          runtime.logger.error('email job failed', { error, ...context });

          if (context.retriesExhausted) {
            reportUnexpectedError(error);
          }
        },
      });

      scope.adopt(queue, async (started) => {
        await drains.stop(JOB_QUEUE_STOP_TIMEOUT_MS);
        await started.stop();
      });

      await queue.start();

      runtime.logger.info('email job queue started');

      return { drains, queue };
    },
  });
}
