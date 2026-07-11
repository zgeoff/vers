import { expect, test } from 'bun:test';
import { toRPCHTTPPath } from './to-rpc-http-path';

test('it joins path segments with slashes', () => {
  expect(toRPCHTTPPath(['user', 'getCurrentUser'])).toBe('/user/getCurrentUser');
});

test('it percent-encodes each segment', () => {
  expect(toRPCHTTPPath(['a b'])).toBe('/a%20b');
});
