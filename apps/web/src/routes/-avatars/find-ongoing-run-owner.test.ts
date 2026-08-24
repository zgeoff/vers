import { expect, test } from 'bun:test';
import { createMockActivitySnapshot, createMockAvatarSnapshot } from '@vers/idle-core/test-utils';
import { findOngoingRunOwner } from './find-ongoing-run-owner';

test('it names the running activity avatar as the owner', () => {
  const activity = createMockActivitySnapshot();
  const liveAvatar = createMockAvatarSnapshot({ id: 'avatar_live', name: 'Karnak' });
  const owner = findOngoingRunOwner(activity, liveAvatar);

  expect(owner).toStrictEqual({ id: 'avatar_live', name: 'Karnak' });
});

test('it finds no owner when an avatar snapshot lingers without a running activity', () => {
  const liveAvatar = createMockAvatarSnapshot({ id: 'avatar_live', name: 'Karnak' });
  const owner = findOngoingRunOwner(undefined, liveAvatar);

  expect(owner).toBeNull();
});

test('it finds no owner when no run is live', () => {
  expect(findOngoingRunOwner(undefined, undefined)).toBeNull();
});
