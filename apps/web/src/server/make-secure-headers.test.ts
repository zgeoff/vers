import { expect, test } from 'bun:test';
import { CSP_NONCE_HEADER } from './csp-nonce-header';
import { makeSecureHeaders } from './make-secure-headers';

test('it stamps a csp nonce header onto the request before calling next', async () => {
  const secureHeaders = makeSecureHeaders({ sentryOrigin: null });

  const request = new Request('https://example.test/');

  let seenNonce: string | null = null;

  await secureHeaders(request, () => {
    seenNonce = request.headers.get(CSP_NONCE_HEADER);

    return Promise.resolve(new Response('ok', { headers: { 'content-type': 'text/html' } }));
  });

  expect(seenNonce).toBeString();
  expect(seenNonce).not.toBe('');
});

test('it applies the csp and fixed security headers to an html response', async () => {
  const secureHeaders = makeSecureHeaders({ sentryOrigin: null });

  const request = new Request('https://example.test/');

  const response = await secureHeaders(request, () =>
    Promise.resolve(new Response('<html></html>', { headers: { 'content-type': 'text/html' } })),
  );

  expect(response.headers.get('content-security-policy')).toInclude('script-src');
  expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');

  expect(response.headers.get('strict-transport-security')).toBe(
    'max-age=15552000; includeSubDomains',
  );

  expect(response.headers.get('referrer-policy')).toBe('same-origin');
});

test('it leaves a non-html response untouched', async () => {
  const secureHeaders = makeSecureHeaders({ sentryOrigin: null });

  const request = new Request('https://example.test/assets/app.js');

  const response = await secureHeaders(request, () =>
    Promise.resolve(new Response('', { headers: { 'content-type': 'text/javascript' } })),
  );

  expect(response.headers.get('content-security-policy')).toBeNil();
  expect(response.headers.get('x-frame-options')).toBeNil();
});

test('it uses the same nonce in the request header and the response csp', async () => {
  const secureHeaders = makeSecureHeaders({ sentryOrigin: null });

  const request = new Request('https://example.test/');

  const response = await secureHeaders(request, () =>
    Promise.resolve(new Response('<html></html>', { headers: { 'content-type': 'text/html' } })),
  );

  const nonce = request.headers.get(CSP_NONCE_HEADER);

  expect(nonce).toBeString();
  expect(response.headers.get('content-security-policy')).toInclude(`'nonce-${nonce}'`);
});
