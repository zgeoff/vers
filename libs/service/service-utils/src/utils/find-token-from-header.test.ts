import { expect, test } from 'bun:test';
import { findTokenFromHeader } from './find-token-from-header';

test('it extracts the token from the header', () => {
  const header = 'Bearer token';
  const token = findTokenFromHeader(header);

  expect(token).toBe('token');
});

test('it returns null if the provided header is null', () => {
  const header = null;
  const token = findTokenFromHeader(header);

  expect(token).toBeNull();
});

test('it returns null if the provided header is undefined', () => {
  const header = undefined;
  const token = findTokenFromHeader(header);

  expect(token).toBeNull();
});

test('it returns null if the provided header is invalid', () => {
  const header = 'Bearer';
  const token = findTokenFromHeader(header);

  expect(token).toBeNull();
});
