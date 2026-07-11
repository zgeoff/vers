import { createEmailClient } from '@vers/email';
import type { JobQueue } from '@vers/jobs';
import { createService } from '@vers/service-runtime';
import type { Service } from '@vers/service-runtime';
import invariant from 'tiny-invariant';
import { buildEmailRouter } from './build-router';
import { createEmailJobQueue } from './create-email-job-queue';
import type { EmailJobDefs } from './create-email-job-queue';
import { EMAIL_ENV_SHAPE } from './email-env-shape';

interface CreateEmailServiceConfig {
  /**
   * Overrides the job queue's connection string in tests. pg-boss pools its own connections
   * straight from a connection string, so it cannot share an injected Kysely transaction handle
   * the way the service's own db access would — isolation goes through a real cloned database
   * instead.
   */
  readonly queueConnectionString?: string;
}

export interface EmailService {
  readonly queue: JobQueue<EmailJobDefs>;
  readonly service: Service<typeof EMAIL_ENV_SHAPE>;
}

/**
 * Boots the email service; the production entrypoints and tests all call this as the one shared
 * config. Returns the job queue alongside the service because production boot and tests both need
 * to `start`/`drain` it directly, outside the request path `buildRouter` runs on.
 */
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
        },
      });

      return buildEmailRouter({ logger: runtime.logger, queue });
    },
    envShape: EMAIL_ENV_SHAPE,
    name: 'service-email',
  });

  invariant(queue, 'buildRouter did not run before createService resolved');

  return { queue, service };
}
