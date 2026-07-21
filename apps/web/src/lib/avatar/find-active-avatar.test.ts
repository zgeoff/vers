import { expect, test } from 'bun:test';
import type { AvatarData } from '@vers/contract-avatar';
import { findActiveAvatar } from './find-active-avatar';

function buildAvatar(id: string): AvatarData {
  return {
    createdAt: new Date('2026-01-01'),
    id,
    level: 1,
    mode: 'trade',
    name: `Avatar${id}`,
    updatedAt: new Date('2026-01-01'),
    userID: 'user-1',
    xp: 0,
  };
}

test('it resolves the selected avatar by id', () => {
  const first = buildAvatar('a');
  const second = buildAvatar('b');

  expect(findActiveAvatar({ activeAvatarID: 'b', avatars: [first, second] })).toBe(second);
});

test('it answers null when nothing is selected', () => {
  expect(findActiveAvatar({ activeAvatarID: null, avatars: [buildAvatar('a')] })).toBeNull();
});

test('it answers null when the selection points at no listed avatar', () => {
  expect(findActiveAvatar({ activeAvatarID: 'gone', avatars: [buildAvatar('a')] })).toBeNull();
});

test('it answers null for an empty roster', () => {
  expect(findActiveAvatar({ activeAvatarID: null, avatars: [] })).toBeNull();
});
