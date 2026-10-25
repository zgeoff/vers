import { expect, test } from 'bun:test';
import { buildKeyPrefixRange } from './build-key-prefix-range';

test('it includes every version of the named activity', () => {
  const range = buildKeyPrefixRange('activity_1');

  expect(range.includes(['activity_1', 1])).toBeTrue();
  expect(range.includes(['activity_1', 999_999])).toBeTrue();
});

test('it excludes versions belonging to a different activity', () => {
  const range = buildKeyPrefixRange('activity_1');

  expect(range.includes(['activity_2', 1])).toBeFalse();
});

test('it includes every node of the named avatar', () => {
  const range = buildKeyPrefixRange('avatar-1');

  expect(range.includes(['avatar-1', '0_0'])).toBeTrue();
  expect(range.includes(['avatar-1', '12_-7'])).toBeTrue();
});

test('it excludes the nodes of a different avatar', () => {
  const range = buildKeyPrefixRange('avatar-1');

  expect(range.includes(['avatar-10', '0_0'])).toBeFalse();
});
