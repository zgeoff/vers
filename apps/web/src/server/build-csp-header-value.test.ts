import { expect, test } from 'bun:test';
import { buildCSPHeaderValue } from './build-csp-header-value';

test('it scopes script-src and script-src-attr to the request nonce', () => {
  const value = buildCSPHeaderValue({ nonce: 'abc123', sentryOrigin: null });

  expect(value).toInclude("script-src 'strict-dynamic' 'self' 'nonce-abc123';");
  expect(value).toInclude("script-src-attr 'nonce-abc123'");
});

test('it never allows string evaluation in script-src', () => {
  const value = buildCSPHeaderValue({ nonce: 'abc123', sentryOrigin: null });

  expect(value).not.toInclude("'unsafe-eval'");
});

test('it omits the error-ingest origin when error reporting is disabled', () => {
  const value = buildCSPHeaderValue({ nonce: 'abc123', sentryOrigin: null });

  expect(value).toInclude("connect-src 'self'");
  expect(value).not.toInclude('https://');
});

test('it allows the error-ingest origin when error reporting is enabled', () => {
  const value = buildCSPHeaderValue({
    nonce: 'abc123',
    sentryOrigin: 'https://errors.example.test',
  });

  expect(value).toInclude("connect-src 'self' https://errors.example.test");
});

test('it restricts fonts to the app origin', () => {
  const value = buildCSPHeaderValue({ nonce: 'abc123', sentryOrigin: null });

  expect(value).toInclude("font-src 'self';");
});
