import { expect, test } from 'bun:test';
import { buildAvatarKeyRange } from './build-avatar-key-range';

test('it includes every node of the named avatar', () => {
  const range = buildAvatarKeyRange('avatar-1');

  expect(range.includes(['avatar-1', '0_0'])).toBeTrue();
  expect(range.includes(['avatar-1', '12_-7'])).toBeTrue();
});

test('it excludes the nodes of a different avatar', () => {
  const range = buildAvatarKeyRange('avatar-1');

  expect(range.includes(['avatar-10', '0_0'])).toBeFalse();
});
