import { expect, test } from 'bun:test';
import { buildUmamiScripts } from './build-umami-scripts';

test('it builds a deferred tracker tag riding the same-origin proxy paths', () => {
  expect(buildUmamiScripts('site-id-123')).toStrictEqual([
    {
      'data-host-url': '/site',
      'data-website-id': 'site-id-123',
      defer: true,
      // oxlint-disable-next-line zgeoff/no-abbreviated-names -- the HTML script attribute is `src`
      src: '/site.js',
    },
  ]);
});

test('it yields no tags when the website ID is not configured', () => {
  expect(buildUmamiScripts(undefined)).toStrictEqual([]);
});

test('it yields no tags for a blank website ID', () => {
  expect(buildUmamiScripts('')).toStrictEqual([]);
  expect(buildUmamiScripts('   ')).toStrictEqual([]);
});
