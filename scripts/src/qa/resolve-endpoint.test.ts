import { expect, test } from 'bun:test';
import { resolveEndpoint } from './resolve-endpoint';

test('it falls back to the local debug port when neither the flag nor the environment names one', () => {
  expect(resolveEndpoint(undefined, undefined)).toBe('127.0.0.1:9222');
});

test('it takes a valid endpoint from the environment', () => {
  expect(resolveEndpoint(undefined, '172.28.80.1:9223')).toBe('172.28.80.1:9223');
});

test('it rejects an invalid endpoint from the environment', () => {
  expect(() => resolveEndpoint(undefined, '127.0.0.1:9222/json')).toThrowWithMessage(
    Error,
    /^QA_CDP_ENDPOINT is invalid: expected host:port/u,
  );
});

test('it lets the flag override the environment', () => {
  expect(resolveEndpoint('127.0.0.1:9333', '172.28.80.1:9223')).toBe('127.0.0.1:9333');
});

test('it takes the flag over an invalid environment value', () => {
  expect(resolveEndpoint('127.0.0.1:9333', 'not-an-endpoint')).toBe('127.0.0.1:9333');
});
