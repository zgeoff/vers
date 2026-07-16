import { createEmailClient } from '@vers/email';
import {
  createLogger,
  flushErrorReports,
  reportUnexpectedError,
  startErrorReporting,
} from '@vers/service-runtime';
import { withTraceContext } from '@vers/service-utils';
import { createTraceContext } from '@vers/trace';
import * as z from 'zod';
import { createEmailJobQueue } from './create-email-job-queue';
import { EMAIL_ENV_SHAPE } from './email-env-shape';

const SWEEP_ENV_SCHEMA = z.object({
  ...EMAIL_ENV_SHAPE,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SENTRY_DSN: z.url().optional(),
});

const env = SWEEP_ENV_SCHEMA.parse(process.env);
const logger = createLogger({ level: env.LOG_LEVEL, name: 'service-email-sweep' });

// this process never calls createService, so reporting needs its own start — the hourly
// scheduled-machine entrypoint drains the queue to completion and exits, rather than running the
// HTTP service, so a delivery a boot drain missed (the process was down when it was enqueued, and
// no later request nudged it) still lands within the hour
await startErrorReporting(env.SENTRY_DSN);

try {
  await withTraceContext(createTraceContext(), async () => {
    const queue = createEmailJobQueue({
      connectionString: env.DATABASE_URL,
      emailClient: createEmailClient({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM }),
      onError: (error) => {
        logger.error({ err: error }, 'email job queue error');

        reportUnexpectedError(error);
      },
      onJobFailed: (error, context) => {
        logger.error({ err: error, ...context }, 'email job failed');

        if (context.retriesExhausted) {
          reportUnexpectedError(error);
        }
      },
    });

    await queue.start();

    const result = await queue.drain();

    logger.info(result, 'swept the email queue');

    await queue.stop();
  });

  process.exit(0);
} catch (error) {
  logger.error({ err: error }, 'email sweep failed');

  reportUnexpectedError(error);

  await flushErrorReports();

  process.exit(1);
}
