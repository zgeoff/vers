import { expect, test } from 'bun:test';
import { createMockActivitySnapshot, createMockAvatarSnapshot } from '@vers/idle-core/test-utils';
import { createMockAvatar } from '../../test-utils/factories/create-mock-avatar';
import { findOngoingRunOwner } from './find-ongoing-run-owner';

test('it names the running activity avatar as the owner', () => {
  const activity = createMockActivitySnapshot();
  const liveAvatar = createMockAvatarSnapshot({ id: 'avatar_live', name: 'Karnak' });
  const avatars = [createMockAvatar({ id: 'avatar_live', name: 'Karnak' })];
  const owner = findOngoingRunOwner(activity, liveAvatar, undefined, avatars);

  expect(owner).toStrictEqual({ id: 'avatar_live', name: 'Karnak' });
});

test('it finds no owner when an avatar snapshot lingers without a running activity', () => {
  const liveAvatar = createMockAvatarSnapshot({ id: 'avatar_live', name: 'Karnak' });
  const avatars = [createMockAvatar({ id: 'avatar_live', name: 'Karnak' })];
  const owner = findOngoingRunOwner(undefined, liveAvatar, undefined, avatars);

  expect(owner).toBeNull();
});

test('it resolves the owner name from the roster for a parked start intent', () => {
  const avatars = [createMockAvatar({ id: 'avatar_parked', name: 'Zetha' })];

  const owner = findOngoingRunOwner(
    undefined,
    undefined,
    {
      activityID: 'activity_1',
      avatarID: 'avatar_parked',
      scopeID: 'scope_1',
      scopeType: 'node',
    },
    avatars,
  );

  expect(owner).toStrictEqual({ id: 'avatar_parked', name: 'Zetha' });
});

test('it finds no owner when neither a running activity nor a parked intent is present', () => {
  const avatars = [createMockAvatar()];
  const owner = findOngoingRunOwner(undefined, undefined, undefined, avatars);

  expect(owner).toBeNull();
});

test('it finds no owner when a parked intent names an avatar absent from the roster', () => {
  const avatars = [createMockAvatar({ id: 'avatar_other' })];

  const owner = findOngoingRunOwner(
    undefined,
    undefined,
    {
      activityID: 'activity_1',
      avatarID: 'avatar_missing',
      scopeID: 'scope_1',
      scopeType: 'node',
    },
    avatars,
  );

  expect(owner).toBeNull();
});

test('it prefers the running activity avatar over a parked intent naming a different avatar', () => {
  const activity = createMockActivitySnapshot();
  const liveAvatar = createMockAvatarSnapshot({ id: 'avatar_live', name: 'Karnak' });

  const avatars = [
    createMockAvatar({ id: 'avatar_live', name: 'Karnak' }),
    createMockAvatar({ id: 'avatar_parked', name: 'Zetha' }),
  ];

  const owner = findOngoingRunOwner(
    activity,
    liveAvatar,
    {
      activityID: 'activity_1',
      avatarID: 'avatar_parked',
      scopeID: 'scope_1',
      scopeType: 'node',
    },
    avatars,
  );

  expect(owner).toStrictEqual({ id: 'avatar_live', name: 'Karnak' });
});
