import { isNonNullable } from '@vers/utils';
import type { Context, Next } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { env } from '../env';

const secureHeadersConfig = secureHeaders({
  contentSecurityPolicy: {
    connectSrc: [
      env.isDevelopment ? 'ws:' : null,
      // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
      env.SENTRY_DSN ? '*.sentry.io' : null,
      "'self'",
    ].filter((element) => isNonNullable(element)),
    fontSrc: ["'self'"],
    frameSrc: ["'self'"],
    imgSrc: ["'self'", 'data:'],
    mediaSrc: ["'self'", 'data:'],
    scriptSrc: [
      "'unsafe-eval'",
      "'strict-dynamic'",
      "'self'",
      (c) => `'nonce-${c.get('cspNonce')}'`,
    ],
    scriptSrcAttr: [(c) => `'nonce-${c.get('cspNonce')}'`],
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: 'same-origin',
});

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export async function setSecureHeaders(ctx: Context<object, string>, next: Next) {
  await next();

  // check if the response is HTML before applying the CSP headers
  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  if (ctx.res.headers.get('Content-Type')?.includes('text/html')) {
    await secureHeadersConfig(ctx, () => Promise.resolve());
  }
}
