import crypto from 'node:crypto';
import { buildCSPHeaderValue } from './build-csp-header-value';
import { CSP_NONCE_HEADER } from './csp-nonce-header';
import type { Middleware } from './middleware';

/**
 * Fixed (non-CSP) security headers applied to every HTML response. Cross-Origin-Embedder-Policy is
 * intentionally left unset — this app embeds cross-origin subresources it doesn't control.
 */
const FIXED_SECURE_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ['Cross-Origin-Resource-Policy', 'same-origin'],
  ['Cross-Origin-Opener-Policy', 'same-origin'],
  ['Origin-Agent-Cluster', '?1'],
  ['Referrer-Policy', 'same-origin'],
  ['Strict-Transport-Security', 'max-age=15552000; includeSubDomains'],
  ['X-Content-Type-Options', 'nosniff'],
  ['X-DNS-Prefetch-Control', 'off'],
  ['X-Download-Options', 'noopen'],
  ['X-Frame-Options', 'SAMEORIGIN'],
  ['X-Permitted-Cross-Domain-Policies', 'none'],
  ['X-XSS-Protection', '0'],
];

interface MakeSecureHeadersOptions {
  readonly sentryEnabled: boolean;
}

/**
 * Builds the secure-headers middleware: stamps a fresh CSP nonce onto the request — read back by
 * the router factory via `getRequestHeader` to configure `ssr.nonce` — then, for HTML responses
 * only, applies the CSP and the fixed security header set.
 */
export function makeSecureHeaders(options: MakeSecureHeadersOptions): Middleware {
  return async (request, next) => {
    const nonce = crypto.randomBytes(16).toString('hex');

    request.headers.set(CSP_NONCE_HEADER, nonce);

    const response = await next();

    const contentType = response.headers.get('content-type');

    if (contentType === null || !contentType.includes('text/html')) {
      return response;
    }

    const headers = new Headers(response.headers);

    headers.set(
      'Content-Security-Policy',
      buildCSPHeaderValue({ nonce, sentryEnabled: options.sentryEnabled }),
    );

    for (const [name, value] of FIXED_SECURE_HEADERS) {
      headers.set(name, value);
    }

    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  };
}
