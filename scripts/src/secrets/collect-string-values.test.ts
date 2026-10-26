import { expect, test } from 'bun:test';
import { collectStringValues } from './collect-string-values';

test('it collects every string value at any depth', () => {
  expect(
    collectStringValues({
      servers: { tracker: { args: ['-c', 'op read "op://ops/tracker/token"'], debug: false } },
      port: 3000,
    }),
  ).toStrictEqual(['-c', 'op read "op://ops/tracker/token"']);
});

test('it collects nothing from a value with no strings', () => {
  expect(collectStringValues({ enabled: true, proxy: null, retries: 3 })).toStrictEqual([]);
});
