import { expect, test } from 'bun:test';
import { getTokenFromHeader } from './get-token-from-header';

test('it extracts the token from the header', () => {
  const header = 'Bearer token';
  const token = getTokenFromHeader(header);

  expect(token).toBe('token');
});

test('it returns null if the provided header is null', () => {
  const header = null;
  const token = getTokenFromHeader(header);

  expect(token).toBeNull();
});

test('it returns null if the provided header is undefined', () => {
  const header = undefined;
  const token = getTokenFromHeader(header);

  expect(token).toBeNull();
});

test('it returns null if the provided header is invalid', () => {
  const header = 'Bearer';
  const token = getTokenFromHeader(header);

  expect(token).toBeNull();
});
