import { expect, test } from 'bun:test';
import { createAvatar } from '../../entities/create-avatar';
import { createMockAvatarData } from '../../test-utils/factories/create-mock-avatar-data';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import { EquipmentSlot, LifecycleEvent } from '../../types';
import { create } from './create';

test('it creates a behaviour with the correct values', () => {
  const avatarData = createMockAvatarData({
    paperdoll: {
      [EquipmentSlot.MainHand]: {
        id: 'test-weapon',
        maxDamage: 10,
        minDamage: 10,
        name: 'Test Weapon',
        speed: 1,
      },
    },
  });

  const ctx = createMockSimulationContext();
  const avatar = createAvatar(avatarData, ctx);
  const behaviour = create(avatar);

  expect(behaviour.lastAttackTime).toBe(0);
  expect(behaviour.nextAttackTime).toBe(1000);
});

test('it exposes a method for getting the state', () => {
  const avatarData = createMockAvatarData();
  const ctx = createMockSimulationContext();
  const avatar = createAvatar(avatarData, ctx);
  const behaviour = create(avatar);

  expect(behaviour.getState()).toStrictEqual({
    lastAttackTime: 0,
  });
});

test('it exposes a method for setting the state', () => {
  const avatarData = createMockAvatarData();
  const ctx = createMockSimulationContext();
  const avatar = createAvatar(avatarData, ctx);
  const behaviour = create(avatar);

  behaviour.setState((draft) => {
    draft.lastAttackTime = 2000;
  });

  expect(behaviour.getState()).toStrictEqual({
    lastAttackTime: 2000,
  });
});

test('it handles the reset event', () => {
  const avatarData = createMockAvatarData();
  const ctx = createMockSimulationContext();
  const avatar = createAvatar(avatarData, ctx);
  const behaviour = create(avatar);

  behaviour.setState((draft) => {
    draft.lastAttackTime = 2000;
  });

  behaviour.handlers[LifecycleEvent.Reset]?.(avatar, ctx);

  expect(behaviour.state).toStrictEqual({
    lastAttackTime: 0,
  });
});
