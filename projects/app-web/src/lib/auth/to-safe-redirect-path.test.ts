import { expect, test } from 'bun:test';
import { toSafeRedirectPath } from './to-safe-redirect-path';

test('it passes through a same-origin path', () => {
  expect(toSafeRedirectPath('/account?tab=security', '/')).toBe('/account?tab=security');
});

test('it falls back for a missing target', () => {
  expect(toSafeRedirectPath(undefined, '/')).toBe('/');
  expect(toSafeRedirectPath(null, '/')).toBe('/');
  expect(toSafeRedirectPath('', '/')).toBe('/');
});

test('it falls back for a target with no leading slash', () => {
  expect(toSafeRedirectPath('account', '/')).toBe('/');
});

test('it falls back for a protocol-relative target', () => {
  expect(toSafeRedirectPath('//evil.example', '/')).toBe('/');
});

test('it falls back for a backslash-variant target', () => {
  expect(toSafeRedirectPath(String.raw`/\evil.example`, '/')).toBe('/');
});
