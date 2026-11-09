import { expect, test } from 'bun:test';
import { isProxiedProcedure } from './is-proxied-procedure';

test.each([
  { path: ['getCurrentActivity'], service: 'activity' },
  { path: ['getAvatars'], service: 'avatar' },
  { path: ['createQAAccount'], service: 'avatar' },
] as const)('it proxies $path on the $service service', (row) => {
  expect(isProxiedProcedure(row.service, row.path)).toBeTrue();
});

test.each([
  { path: ['createQAAccount'] },
  { path: ['%63reateQAAccount'] },
  { path: ['createQAAccount', 'extra'] },
  { path: ['%E0%A4%A'] },
])('it refuses $path on the activity service', (row) => {
  expect(isProxiedProcedure('activity', row.path)).toBeFalse();
});
