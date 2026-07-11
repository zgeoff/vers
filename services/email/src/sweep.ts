import { createEmailClient } from '@vers/email';
import { createLogger } from '@vers/service-runtime';
import * as z from 'zod';
import { createEmailJobQueue } from './create-email-job-queue';
import { EMAIL_ENV_SHAPE } from './email-env-shape';

/**
 * The hourly scheduled-machine entrypoint: drains the queue to completion and exits, rather than
 * running the HTTP service, so a delivery a boot drain missed (the process was down when it was
 * enqueued, and no later request nudged it) still lands within the hour.
 */
const SWEEP_ENV_SCHEMA = z.object({
  ...EMAIL_ENV_SHAPE,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const env = SWEEP_ENV_SCHEMA.parse(process.env);
const logger = createLogger({ level: env.LOG_LEVEL, name: 'service-email-sweep' });

try {
  const queue = createEmailJobQueue({
    connectionString: env.DATABASE_URL,
    emailClient: createEmailClient({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM }),
    onError: (error) => {
      logger.error({ err: error }, 'email job queue error');
    },
  });

  await queue.start();

  const result = await queue.drain();

  logger.info(result, 'swept the email queue');

  await queue.stop();

  process.exit(0);
} catch (error) {
  logger.error({ err: error }, 'email sweep failed');
  process.exit(1);
}
