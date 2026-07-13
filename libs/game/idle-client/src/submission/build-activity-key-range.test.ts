import { expect, test } from 'bun:test';
import { buildActivityKeyRange } from './build-activity-key-range';

test('it includes every version of the named activity', () => {
  const range = buildActivityKeyRange('activity_1');

  expect(range.includes(['activity_1', 1])).toBeTrue();
  expect(range.includes(['activity_1', 999_999])).toBeTrue();
});

test('it excludes versions belonging to a different activity', () => {
  const range = buildActivityKeyRange('activity_1');

  expect(range.includes(['activity_2', 1])).toBeFalse();
});
