import { serve } from '@hono/node-server';
import { sentry } from '@hono/sentry';
import { trpcServer } from '@hono/trpc-server';
import { createLoggerMiddleware } from '@vers/service-utils';
import { requestId } from 'hono/request-id';
import { app } from './app';
import { db } from './db';
import { env } from './env';
import { logger } from './logger';
import { router } from './router';

const sentryOptions = env.SENTRY_DSN === undefined ? undefined : { dsn: env.SENTRY_DSN };

app.use('*', sentry(sentryOptions));
app.use('*', requestId());
app.use('*', createLoggerMiddleware(logger));

app.use('/trpc/*', trpcServer({ createContext: () => ({ db }), router }));

serve({ fetch: app.fetch, hostname: env.HOSTNAME, port: env.PORT });

logger.info(`Serving Avatar API @ http://${env.HOSTNAME}:${env.PORT}`);
