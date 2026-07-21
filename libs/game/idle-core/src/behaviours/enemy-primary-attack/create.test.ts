import { expect, test } from 'bun:test';
import { createEnemy } from '../../entities/create-enemy';
import { createMockEnemyData } from '../../test-utils/factories/create-mock-enemy-data';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import { LifecycleEvent } from '../../types';
import { create } from './create';

test('it creates a behaviour with the correct values', () => {
  const enemyData = createMockEnemyData({
    primaryAttack: {
      maxDamage: 10,
      minDamage: 10,
      speed: 1,
    },
  });

  const ctx = createMockSimulationContext();
  const enemy = createEnemy('test-enemy', enemyData, ctx);
  const behaviour = create(enemy);

  expect(behaviour.lastAttackTime).toBe(0);
  expect(behaviour.nextAttackTime).toBe(1000);
});

test('it exposes a method for getting the state', () => {
  const enemyData = createMockEnemyData();
  const ctx = createMockSimulationContext();
  const enemy = createEnemy('test-enemy', enemyData, ctx);
  const behaviour = create(enemy);

  expect(behaviour.getState()).toStrictEqual({
    lastAttackTime: 0,
  });
});

test('it exposes a method for setting the state', () => {
  const enemyData = createMockEnemyData();
  const ctx = createMockSimulationContext();
  const enemy = createEnemy('test-enemy', enemyData, ctx);
  const behaviour = create(enemy);

  behaviour.setState((draft) => {
    draft.lastAttackTime = 2000;
  });

  expect(behaviour.getState()).toStrictEqual({
    lastAttackTime: 2000,
  });
});

test('it leaves a previously captured state object unchanged after a later setState call', () => {
  const enemyData = createMockEnemyData();
  const ctx = createMockSimulationContext();
  const enemy = createEnemy('test-enemy', enemyData, ctx);
  const behaviour = create(enemy);
  const capturedState = behaviour.getState();

  behaviour.setState((draft) => {
    draft.lastAttackTime = 2000;
  });

  expect(capturedState).toStrictEqual({ lastAttackTime: 0 });
  expect(behaviour.getState()).toStrictEqual({ lastAttackTime: 2000 });
});

test('it handles the reset event', () => {
  const enemyData = createMockEnemyData({
    primaryAttack: {
      maxDamage: 10,
      minDamage: 10,
      speed: 1,
    },
  });

  const ctx = createMockSimulationContext();
  const enemy = createEnemy('test-enemy', enemyData, ctx);
  const behaviour = create(enemy);

  behaviour.setState((draft) => {
    draft.lastAttackTime = 2000;
  });

  behaviour.handlers[LifecycleEvent.Reset]?.(enemy, ctx);

  expect(behaviour.state).toStrictEqual({
    lastAttackTime: 0,
  });
});
