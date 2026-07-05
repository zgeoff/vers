import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { env } from '../env';

export function initSentry() {
  Sentry.init({
    beforeSendTransaction(event) {
      // ignore all healthcheck related transactions
      // note that name of header here is case-sensitive
      if (event.request?.headers?.['x-healthcheck'] === 'true') {
        return null;
      }

      return event;
    },
    denyUrls: [
      /\/resources\/healthcheck/,
      /\/build\//,
      /\/favicons\//,
      /\/img\//,
      /\/fonts\//,
      /\/favicon.ico/,
      /\/site\.webmanifest/,
    ],
    ...(env.SENTRY_DSN !== undefined && { dsn: env.SENTRY_DSN }),
    environment: env.NODE_ENV,
    integrations: [Sentry.httpIntegration(), nodeProfilingIntegration()],
    tracesSampleRate: env.isProduction ? 1 : 0,
  });
}
