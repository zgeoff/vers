import { renderHook } from '@testing-library/react';
import { Class } from '@vers/data';
import type { AvatarAppState } from '@vers/idle-core';
import { EntityStatus } from '@vers/idle-core';
import { expect, test } from 'vitest';
import { setAvatar } from './set-avatar';
import { useAvatar } from './use-avatar';

test('it provides the avatar state', () => {
  const avatar: AvatarAppState = {
    behaviours: {
      avatarWeaponAttack: {
        lastAttackTime: 0,
      },
    },
    class: Class.Brute,
    id: '1',
    isAlive: true,
    level: 1,
    life: 75,
    mainHandAttack: {
      maxDamage: 10,
      minDamage: 5,
      speed: 1,
    },
    maxLife: 100,
    name: 'Test Avatar',
    status: EntityStatus.Alive,
  };

  setAvatar(avatar);

  const { result } = renderHook(() => useAvatar());

  expect(result.current).toStrictEqual({
    behaviours: {
      avatarWeaponAttack: {
        lastAttackTime: 0,
      },
    },
    class: Class.Brute,
    id: '1',
    isAlive: true,
    level: 1,
    life: 75,
    mainHandAttack: {
      maxDamage: 10,
      minDamage: 5,
      speed: 1,
    },
    maxLife: 100,
    name: 'Test Avatar',
    status: EntityStatus.Alive,
  });
});
