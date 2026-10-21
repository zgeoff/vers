import { expect, test } from 'bun:test';
import { toJSON } from './to-json';

test('it keeps a nested JSON value as it is', () => {
  expect(
    toJSON({ rewards: { items: ['lantern', 'rope'], xp: 40 }, settled: true, note: null }),
  ).toStrictEqual({ rewards: { items: ['lantern', 'rope'], xp: 40 }, settled: true, note: null });
});

test('it drops a member whose value is undefined', () => {
  expect(toJSON({ kind: 'started', reason: undefined })).toStrictEqual({ kind: 'started' });
});

test('it writes a Date as its ISO string', () => {
  expect(toJSON({ at: new Date('2026-03-04T05:06:07.000Z') })).toStrictEqual({
    at: '2026-03-04T05:06:07.000Z',
  });
});
