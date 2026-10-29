import { expect, test } from 'bun:test';
import { addResyncSettledAvatarID } from './add-resync-settled-avatar-id';
import { setResyncSettledAvatarIDs } from './set-resync-settled-avatar-ids';
import { useIdleStore } from './use-idle-store';

test("it replaces the settled avatars with a new writer's report", () => {
  addResyncSettledAvatarID('avatar_old_writer');
  setResyncSettledAvatarIDs(['avatar_new_writer']);

  expect(useIdleStore.getState().resyncSettledAvatarIDs).toStrictEqual(['avatar_new_writer']);
});
