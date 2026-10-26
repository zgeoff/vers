import { createEmailClient } from '@vers/email';
import {
  flushErrorReports,
  reportUnexpectedError,
  startErrorReporting,
} from '@vers/service-runtime';
import { configureLogging } from '@vers/service-runtime/logging';
import { withRootSpan } from '@vers/service-utils';
import * as z from 'zod';
import { createEmailJobQueue } from './create-email-job-queue';
import { envShape } from './env-shape';

const SWEEP_ENV_SCHEMA = z.object({
  ...envShape,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SENTRY_DSN: z.url().optional(),
});

const env = SWEEP_ENV_SCHEMA.parse(process.env);

const logger = configureLogging({
  category: 'service-email-sweep',
  format: 'json',
  level: env.LOG_LEVEL,
});

// this process never calls createService, so error reporting needs its own start
await startErrorReporting(env.SENTRY_DSN);

// the try/catch lives inside the span so a failure report still carries the run's trace id
await withRootSpan('email.sweep', async () => {
  try {
    const queue = createEmailJobQueue({
      connectionString: env.DATABASE_URL,
      emailClient: createEmailClient({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM }),
      logger,
      onError: (error) => {
        logger.error('email job queue error', { error });

        reportUnexpectedError(error);
      },
      onJobFailed: (error, context) => {
        logger.error('email job failed', { error, ...context });

        if (context.retriesExhausted) {
          reportUnexpectedError(error);
        }
      },
    });

    await queue.start();

    const result = await queue.drain();

    logger.info('swept the email queue', { ...result });

    await queue.stop();

    // reports captured during a successful drain (a per-job failure, a queue fault) still need
    // delivery before the process dies
    const flushed = await flushErrorReports();

    if (!flushed) {
      logger.warn('error reports were still queued when the flush timed out');
    }

    process.exit(0);
  } catch (error) {
    logger.error('email sweep failed', { error });

    reportUnexpectedError(error);

    const flushed = await flushErrorReports();

    if (!flushed) {
      logger.warn('error reports were still queued when the flush timed out');
    }

    process.exit(1);
  }
});
