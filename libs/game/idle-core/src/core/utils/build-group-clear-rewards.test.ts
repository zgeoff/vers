import { expect, test } from 'bun:test';
import { createMockActivityData } from '../../test-utils/create-mock-activity-data';
import { createMockEnemyData } from '../../test-utils/create-mock-enemy-data';
import { createMockSimulationContext } from '../../test-utils/create-mock-simulation-context';
import { buildGroupClearRewards } from './build-group-clear-rewards';
import { createEnemyGroup } from './create-enemy-group';

test('it sums the difficulty-scaled xp of every enemy in the group', () => {
  const enemyData = createMockEnemyData({ xp: 10 });
  const activity = createMockActivityData({ enemies: [enemyData] });
  const ctx = createMockSimulationContext();
  const group = createEnemyGroup(activity, ctx, 3);

  expect(buildGroupClearRewards(group, 1)).toStrictEqual({ xp: 30 });
});

test('it returns zero xp for an empty group', () => {
  const activity = createMockActivityData();
  const ctx = createMockSimulationContext();
  const group = createEnemyGroup(activity, ctx, 0);

  expect(buildGroupClearRewards(group, 1)).toStrictEqual({ xp: 0 });
});

test('it scales the summed xp by difficulty', () => {
  const enemyData = createMockEnemyData({ xp: 10 });
  const activity = createMockActivityData({ enemies: [enemyData] });
  const ctx = createMockSimulationContext();
  const group = createEnemyGroup(activity, ctx, 2);

  expect(buildGroupClearRewards(group, 2)).toStrictEqual({ xp: 40 });
});
