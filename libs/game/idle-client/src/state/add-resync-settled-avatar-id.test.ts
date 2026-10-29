import { expect, test } from 'bun:test';
import { addResyncSettledAvatarID } from './add-resync-settled-avatar-id';
import { setResyncSettledAvatarIDs } from './set-resync-settled-avatar-ids';
import { useIdleStore } from './use-idle-store';

test('it adds an avatar whose resync settled to the ones the writer already reported', () => {
  setResyncSettledAvatarIDs(['avatar_reported']);
  addResyncSettledAvatarID('avatar_settled');

  expect(useIdleStore.getState().resyncSettledAvatarIDs).toStrictEqual([
    'avatar_reported',
    'avatar_settled',
  ]);
});

test('it keeps one entry for an avatar whose resync settles again', () => {
  setResyncSettledAvatarIDs(['avatar_twice']);
  addResyncSettledAvatarID('avatar_twice');

  expect(useIdleStore.getState().resyncSettledAvatarIDs).toStrictEqual(['avatar_twice']);
});
