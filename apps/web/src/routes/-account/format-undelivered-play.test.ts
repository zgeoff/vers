import { expect, test } from 'bun:test';
import { formatUndeliveredPlay } from './format-undelivered-play';

test('it uses the singular noun for one run', () => {
  expect(formatUndeliveredPlay({ activityCount: 1, playMs: 90_000 })).toStartWith('1 run,');
});

test('it uses the plural noun for more than one run', () => {
  expect(formatUndeliveredPlay({ activityCount: 3, playMs: 90_000 })).toStartWith('3 runs,');
});

test('it reports under a minute for a span shorter than 60 seconds', () => {
  expect(formatUndeliveredPlay({ activityCount: 2, playMs: 45_000 })).toBe(
    '2 runs, under a minute of play',
  );
});

test('it rounds a longer span to whole minutes', () => {
  expect(formatUndeliveredPlay({ activityCount: 3, playMs: 12 * 60_000 })).toBe(
    '3 runs, about 12 minutes of play',
  );
});

test('it names the runs alone when the report holds no queued play', () => {
  expect(formatUndeliveredPlay({ activityCount: 1, playMs: 0 })).toBe('1 run');
});
