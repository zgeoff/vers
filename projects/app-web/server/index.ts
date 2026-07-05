import { remoteAddressMiddleware } from '@vers/service-utils';
import { compress } from 'hono/compress';
import { poweredBy } from 'hono/powered-by';
import { Hono } from 'hono/quick';
import { createHonoServer } from 'react-router-hono-server/node';
import { createGQLClient } from '../app/utils/create-gql-client.server';
import { env } from './env';
import { logger as appLogger } from './logger';
import { enforceHTTPS } from './middleware/enforce-https';
import { logger } from './middleware/logger';
import { rateLimit } from './middleware/rate-limit';
import { removeTrailingSlash } from './middleware/remove-trailing-slash';
import { setCSPNonce } from './middleware/set-csp-nonce';
import { setSecureHeaders } from './middleware/set-secure-headers';

// oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
if (env.isProduction && env.SENTRY_DSN) {
  // oxlint-disable-next-line unicorn/prefer-top-level-await -- sentry init is deliberately fire-and-forget so it never delays server startup
  void (async () => {
    const { initSentry } = await import('./utils/init-sentry');

    initSentry();
  })();
}

// the seed is e2e-only: gated on the build mode so it never runs under `dev`
// (which also mocks the network) and can't leak into a production bundle
if (import.meta.env.MODE === 'e2e') {
  void import('../app/mocks/e2e-migration');
}

const app = new Hono();

export default await createHonoServer({
  app,
  configure: (server) => {
    server.use('*', logger);
    server.use('*', removeTrailingSlash);
    server.use('*', enforceHTTPS);
    server.use('*', remoteAddressMiddleware);
    server.use('*', setCSPNonce);
    server.use('*', setSecureHeaders);
    server.use('*', rateLimit);
    server.use('*', poweredBy({ serverName: 'vers-idle' }));

    // if we made it past our static asset serving and reached out, bail out
    server.on('GET', ['/favicons/*', '/img/*'], (c) => c.text('Not found', 404));

    server.use(compress());

    server.onError((error, ctx) => {
      appLogger.error(error);

      return ctx.text('Internal Server Error', 500);
    });
  },
  defaultLogger: false,
  getLoadContext: async (ctx, opts) => {
    // instantiate our GQL client as part of our load context so
    // we only have a single instance. prevents issues with refreshing
    // tokens for multiple inflight requests, etc.
    const client = await createGQLClient(ctx.req.raw);

    return {
      client,
      cspNonce: ctx.get('cspNonce'),
      serverBuild: opts.build,
    };
  },
});
