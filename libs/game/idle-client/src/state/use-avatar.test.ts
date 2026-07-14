import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { EntityStatus, createMockAvatarSnapshot } from '@vers/idle-core';
import { useAvatar } from './use-avatar';
import { useIdleStore } from './use-idle-store';

test('it provides the avatar state', () => {
  const avatar = createMockAvatarSnapshot({
    behaviours: {
      avatar_weapon_attack: {
        lastAttackTime: 0,
      },
    },
    id: '1',
    life: 75,
    mainHandAttack: {
      maxDamage: 10,
      minDamage: 5,
      speed: 1,
    },
    status: EntityStatus.Alive,
  });

  useIdleStore.setState({ avatar });

  const hook = renderHook(() => useAvatar());

  expect(hook.result.current).toStrictEqual({
    behaviours: {
      avatar_weapon_attack: {
        lastAttackTime: 0,
      },
    },
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
