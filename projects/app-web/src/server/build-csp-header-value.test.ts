import { expect, test } from 'bun:test';
import { buildCSPHeaderValue } from './build-csp-header-value';

test('it scopes script-src and script-src-attr to the request nonce', () => {
  const value = buildCSPHeaderValue({ nonce: 'abc123', sentryEnabled: false });

  expect(value).toInclude("script-src 'unsafe-eval' 'strict-dynamic' 'self' 'nonce-abc123'");
  expect(value).toInclude("script-src-attr 'nonce-abc123'");
});

test('it omits the sentry ingest origin when sentry is disabled', () => {
  const value = buildCSPHeaderValue({ nonce: 'abc123', sentryEnabled: false });

  expect(value).toInclude("connect-src 'self'");
  expect(value).not.toInclude('sentry.io');
});

test('it allows the sentry ingest origin when sentry is enabled', () => {
  const value = buildCSPHeaderValue({ nonce: 'abc123', sentryEnabled: true });

  expect(value).toInclude("connect-src 'self' *.sentry.io");
});
