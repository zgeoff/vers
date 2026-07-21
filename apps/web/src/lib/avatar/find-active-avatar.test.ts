import { expect, test } from 'bun:test';
import { createMockAvatar } from '../../test-utils/factories/create-mock-avatar';
import { findActiveAvatar } from './find-active-avatar';

test('it resolves the selected avatar by id', () => {
  const first = createMockAvatar();
  const second = createMockAvatar();

  expect(findActiveAvatar({ activeAvatarID: second.id, avatars: [first, second] })).toBe(second);
});

test('it answers null when nothing is selected', () => {
  expect(findActiveAvatar({ activeAvatarID: null, avatars: [createMockAvatar()] })).toBeNull();
});

test('it answers null when the selection points at no listed avatar', () => {
  expect(findActiveAvatar({ activeAvatarID: 'gone', avatars: [createMockAvatar()] })).toBeNull();
});

test('it answers null for an empty roster', () => {
  expect(findActiveAvatar({ activeAvatarID: null, avatars: [] })).toBeNull();
});
