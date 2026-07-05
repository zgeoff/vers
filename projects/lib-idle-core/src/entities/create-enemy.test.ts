import invariant from 'tiny-invariant';
import { expect, test, vi } from 'vitest';
import { createActivity } from '../core/create-activity';
import { createCombatExecutor } from '../core/create-combat-executor';
import { createEnemyGroup } from '../core/utils/create-enemy-group';
import { createMockActivityData } from '../test-utils/create-mock-activity-data';
import { createMockAvatarData } from '../test-utils/create-mock-avatar-data';
import { createMockEnemyData } from '../test-utils/create-mock-enemy-data';
import { createMockSimulationContext } from '../test-utils/create-mock-simulation-context';
import type { CombatLifecycleHandler, Enemy, EnemyTestBehaviour } from '../types';
import { BehaviourID, EntityStatus, EntityType, LifecycleEvent } from '../types';
import { createAvatar } from './create-avatar';
import { createEnemy } from './create-enemy';

test('it creates an enemy with correct initial values', () => {
  const ctx = createMockSimulationContext();
  const data = createMockEnemyData();

  const enemy = createEnemy(data, ctx);

  expect(enemy.id).toStrictEqual(expect.any(String));
  expect(enemy.level).toBe(data.level);
  expect(enemy.name).toBe(data.name);
  expect(enemy.type).toBe(EntityType.Enemy);
  expect(enemy.life).toBe(data.life);
  expect(enemy.status).toBe(EntityStatus.Alive);
  expect(enemy.isAlive).toBeTrue();
});

test('it exposes a method for setting the enemy state', () => {
  const ctx = createMockSimulationContext();
  const data = createMockEnemyData();
  const enemy = createEnemy(data, ctx);

  enemy.setState((draftState) => {
    draftState.life = 9999;
  });

  expect(enemy.life).toBe(9999);
});

test('it reduces life and updates status when killed', () => {
  const ctx = createMockSimulationContext();

  const data = createMockEnemyData({
    life: 100,
  });

  const enemy = createEnemy(data, ctx);

  enemy.receiveDamage(10);

  expect(enemy.life).toBe(90);
  expect(enemy.status).toBe(EntityStatus.Alive);
  expect(enemy.isAlive).toBeTrue();

  enemy.receiveDamage(95);

  expect(enemy.life).toBe(0);
  expect(enemy.status).toBe(EntityStatus.Dead);
  expect(enemy.isAlive).toBeFalse();
});

test('it calls all registered handlers when handling a tick', () => {
  const ctx = createMockSimulationContext();
  const avatarData = createMockAvatarData();
  const avatar = createAvatar(avatarData, ctx);
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);
  const enemyGroup = createEnemyGroup(activityData, ctx, 1);
  const combatExecutor = createCombatExecutor(activity, avatar, ctx);

  const handlerSpy = vi.fn<CombatLifecycleHandler<Enemy>>();

  const behaviour: EnemyTestBehaviour = {
    getState: () => ({}),
    handlers: {
      [LifecycleEvent.OnTick]: handlerSpy,
    },
    id: BehaviourID.Test,
    predicate: () => true,
    setState: vi.fn<EnemyTestBehaviour['setState']>(),
    state: {},
  };

  const [enemy] = enemyGroup.enemies;

  invariant(enemy, 'enemy is required');

  enemy.addBehaviour(behaviour);
  enemy.handleTick(combatExecutor, ctx);

  expect(handlerSpy).toHaveBeenCalledWith(enemy, combatExecutor, ctx);
});

test('it allows removing behaviours', () => {
  const ctx = createMockSimulationContext();
  const avatarData = createMockAvatarData();
  const avatar = createAvatar(avatarData, ctx);
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);
  const enemyGroup = createEnemyGroup(activityData, ctx, 1);
  const combatExecutor = createCombatExecutor(activity, avatar, ctx);

  const handlerSpy = vi.fn<CombatLifecycleHandler<Enemy>>();

  const behaviour: EnemyTestBehaviour = {
    getState: () => ({}),
    handlers: {
      [LifecycleEvent.OnTick]: handlerSpy,
    },
    id: BehaviourID.Test,
    predicate: () => true,
    setState: vi.fn<EnemyTestBehaviour['setState']>(),
    state: {},
  };

  const [enemy] = enemyGroup.enemies;

  invariant(enemy, 'enemy is required');

  enemy.addBehaviour(behaviour);
  enemy.removeBehaviour(BehaviourID.Test);
  enemy.handleTick(combatExecutor, ctx);

  expect(handlerSpy).not.toHaveBeenCalled();
});

test('it returns the expected enemy state for a client app', () => {
  const ctx = createMockSimulationContext();
  const data = createMockEnemyData();
  const enemy = createEnemy(data, ctx);

  const state = enemy.getAppState();

  expect(state).toStrictEqual({
    behaviours: {
      enemyPrimaryAttack: {
        lastAttackTime: expect.any(Number),
      },
    },
    id: enemy.id,
    isAlive: true,
    level: enemy.level,
    life: enemy.life,
    maxLife: enemy.life,
    name: enemy.name,
    primaryAttack: {
      maxDamage: expect.any(Number),
      minDamage: expect.any(Number),
      speed: expect.any(Number),
    },
    status: EntityStatus.Alive,
  });
});
