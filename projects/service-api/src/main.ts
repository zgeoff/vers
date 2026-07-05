import { serve } from '@hono/node-server';
import { sentry } from '@hono/sentry';
import {
  createLoggerMiddleware,
  remoteAddressMiddleware,
} from '@vers/service-utils';
import { requestId } from 'hono/request-id';
import { app } from './app';
import { env } from './env';
import { initYoga } from './init-yoga';
import { logger } from './logger';
import { rateLimitMiddleware } from './middleware/rate-limit-middleware';
import { sessionHeaderMiddleware } from './middleware/session-header-middleware';

app.use(
  '*',
  sentry(env.SENTRY_DSN === undefined ? undefined : { dsn: env.SENTRY_DSN }),
);
app.use('*', requestId());
app.use('*', remoteAddressMiddleware);
app.use('*', sessionHeaderMiddleware);
app.use('*', createLoggerMiddleware(logger));
app.use('*', rateLimitMiddleware);

initYoga();

serve({ fetch: app.fetch, hostname: env.HOSTNAME, port: env.PORT });

logger.info(`Serving GraphQL API @ http://${env.HOSTNAME}:${env.PORT}`);
