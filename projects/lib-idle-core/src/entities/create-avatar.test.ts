import { expect, test, vi } from 'vitest';
import { createActivity } from '../core/create-activity';
import { createCombatExecutor } from '../core/create-combat-executor';
import { createMockActivityData } from '../test-utils/create-mock-activity-data';
import { createMockAvatarData } from '../test-utils/create-mock-avatar-data';
import { createMockSimulationContext } from '../test-utils/create-mock-simulation-context';
import type {
  Avatar,
  AvatarTestBehaviour,
  CombatLifecycleHandler,
  LifecycleHandler,
} from '../types';
import { BehaviourID, EntityStatus, EntityType, LifecycleEvent } from '../types';
import { createAvatar } from './create-avatar';

test('it creates an avatar with correct initial values', () => {
  const ctx = createMockSimulationContext();
  const data = createMockAvatarData();

  const avatar = createAvatar(data, ctx);

  expect(avatar.id).toStrictEqual(expect.any(String));
  expect(avatar.level).toBe(data.level);
  expect(avatar.type).toBe(EntityType.Avatar);
  expect(avatar.life).toBe(data.life);
  expect(avatar.status).toBe(EntityStatus.Alive);
  expect(avatar.isAlive).toBeTrue();
});

test('it exposes a method for setting the avatar state', () => {
  const ctx = createMockSimulationContext();
  const data = createMockAvatarData();
  const avatar = createAvatar(data, ctx);

  avatar.setState((draftState) => {
    draftState.life = 9999;
  });

  expect(avatar.life).toBe(9999);
});

test('it reduces life and updates status when killed', () => {
  const ctx = createMockSimulationContext();

  const data = createMockAvatarData({
    life: 100,
  });

  const avatar = createAvatar(data, ctx);

  avatar.receiveDamage(10);

  expect(avatar.life).toBe(90);
  expect(avatar.status).toBe(EntityStatus.Alive);
  expect(avatar.isAlive).toBeTrue();

  // overkill by 5
  avatar.receiveDamage(95);

  expect(avatar.life).toBe(0);
  expect(avatar.status).toBe(EntityStatus.Dead);
  expect(avatar.isAlive).toBeFalse();
});

test('it calls all registered handlers when handling a tick', () => {
  const ctx = createMockSimulationContext();
  const avatarData = createMockAvatarData();
  const avatar = createAvatar(avatarData, ctx);
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);
  const combatExecutor = createCombatExecutor(activity, avatar, ctx);

  const handlerSpy = vi.fn<CombatLifecycleHandler<Avatar>>();

  const behaviour: AvatarTestBehaviour = {
    getState: () => ({}),
    handlers: {
      [LifecycleEvent.OnTick]: handlerSpy,
    },
    id: BehaviourID.Test,
    predicate: () => true,
    setState: vi.fn<AvatarTestBehaviour['setState']>(),
    state: {},
  };

  avatar.addBehaviour(behaviour);
  avatar.handleTick(combatExecutor, ctx);

  expect(handlerSpy).toHaveBeenCalledWith(avatar, combatExecutor, ctx);
});

test('it allows removing behaviours', () => {
  const ctx = createMockSimulationContext();
  const avatarData = createMockAvatarData();
  const avatar = createAvatar(avatarData, ctx);
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);
  const combatExecutor = createCombatExecutor(activity, avatar, ctx);

  const handlerSpy = vi.fn<CombatLifecycleHandler<Avatar>>();

  const behaviour: AvatarTestBehaviour = {
    getState: () => ({}),
    handlers: {
      [LifecycleEvent.OnTick]: handlerSpy,
    },
    id: BehaviourID.Test,
    predicate: () => true,
    setState: vi.fn<AvatarTestBehaviour['setState']>(),
    state: {},
  };

  avatar.addBehaviour(behaviour);
  avatar.removeBehaviour(BehaviourID.Test);
  avatar.handleTick(combatExecutor, ctx);

  expect(handlerSpy).not.toHaveBeenCalled();
});

test('it exposes a method for resetting the avatar', () => {
  const ctx = createMockSimulationContext();
  const avatarData = createMockAvatarData({ life: 100 });
  const avatar = createAvatar(avatarData, ctx);

  avatar.receiveDamage(100);

  expect(avatar.life).toBe(0);
  expect(avatar.status).toBe(EntityStatus.Dead);
  expect(avatar.isAlive).toBeFalse();

  avatar.reset();

  expect(avatar.life).toBe(100);
  expect(avatar.status).toBe(EntityStatus.Alive);
  expect(avatar.isAlive).toBeTrue();
});

test('it resets all behaviour states when resetting the avatar', () => {
  const ctx = createMockSimulationContext();
  const avatarData = createMockAvatarData();
  const avatar = createAvatar(avatarData, ctx);

  const resetHandlerSpy = vi.fn<LifecycleHandler<Avatar>>();

  const behaviour: AvatarTestBehaviour = {
    getState: () => ({}),
    handlers: {
      [LifecycleEvent.Reset]: resetHandlerSpy,
    },
    id: BehaviourID.Test,
    predicate: () => true,
    setState: vi.fn<AvatarTestBehaviour['setState']>(),
    state: {},
  };

  avatar.addBehaviour(behaviour);

  avatar.reset();

  expect(resetHandlerSpy).toHaveBeenCalledWith(avatar, ctx);
});

test('it allows for preserving avatar state when resetting', () => {
  const ctx = createMockSimulationContext();
  const avatarData = createMockAvatarData({ life: 100 });
  const avatar = createAvatar(avatarData, ctx);

  const resetHandlerSpy = vi.fn<LifecycleHandler<Avatar>>();

  const behaviour: AvatarTestBehaviour = {
    getState: () => ({}),
    handlers: {
      [LifecycleEvent.Reset]: resetHandlerSpy,
    },
    id: BehaviourID.Test,
    predicate: () => true,
    setState: vi.fn<AvatarTestBehaviour['setState']>(),
    state: {
      count: 0,
    },
  };

  avatar.addBehaviour(behaviour);
  avatar.receiveDamage(100);

  expect(avatar.life).toBe(0);
  expect(avatar.status).toBe(EntityStatus.Dead);
  expect(avatar.isAlive).toBeFalse();

  avatar.reset({ soft: true });

  expect(resetHandlerSpy).toHaveBeenCalledWith(avatar, ctx);
  expect(avatar.life).toBe(0);
  expect(avatar.status).toBe(EntityStatus.Dead);
  expect(avatar.isAlive).toBeFalse();
});

test('it returns the expected avatar state for a client app', () => {
  const ctx = createMockSimulationContext();
  const data = createMockAvatarData();
  const avatar = createAvatar(data, ctx);

  const state = avatar.getAppState();

  expect(state).toStrictEqual({
    behaviours: {
      avatarWeaponAttack: {
        lastAttackTime: expect.any(Number),
      },
    },
    class: data.class,
    id: avatar.id,
    isAlive: true,
    level: avatar.level,
    life: avatar.life,
    mainHandAttack: {
      maxDamage: expect.any(Number),
      minDamage: expect.any(Number),
      speed: expect.any(Number),
    },
    maxLife: avatar.life,
    name: data.name,
    status: EntityStatus.Alive,
  });
});
