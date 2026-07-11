import { expect, test } from 'bun:test';
import { parseIgnoredAdvisories } from './parse-ignored-advisories';

test('it collects every ignored GHSA id from the audit script', () => {
  const script = 'bun audit --ignore=GHSA-8988-4f7v-96qf --ignore=GHSA-q7rr-3cgh-j5r3';

  expect(parseIgnoredAdvisories(script)).toStrictEqual([
    'GHSA-8988-4f7v-96qf',
    'GHSA-q7rr-3cgh-j5r3',
  ]);
});

test('it returns an empty list for an audit script with no ignores', () => {
  expect(parseIgnoredAdvisories('bun audit')).toStrictEqual([]);
});
