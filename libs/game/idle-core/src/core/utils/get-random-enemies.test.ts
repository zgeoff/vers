import { expect, test } from 'bun:test';
import { createMockActivityData } from '../../test-utils/create-mock-activity-data';
import { createMockEnemyData } from '../../test-utils/create-mock-enemy-data';
import { createMockSimulationContext } from '../../test-utils/create-mock-simulation-context';
import { getRandomEnemies } from './get-random-enemies';

test('returns the correct number of enemies', () => {
  const activity = createMockActivityData();
  const ctx = createMockSimulationContext();
  const enemies = getRandomEnemies(activity, 3, ctx);

  expect(enemies).toHaveLength(3);
});

test('it gets a random assortment of enemies', () => {
  const enemyData1 = createMockEnemyData({ name: 'Enemy #1' });
  const enemyData2 = createMockEnemyData({ name: 'Enemy #2' });
  const enemyData3 = createMockEnemyData({ name: 'Enemy #3' });

  const activity = createMockActivityData({
    enemies: [enemyData1, enemyData2, enemyData3],
  });

  const ctx = createMockSimulationContext();
  const enemies = getRandomEnemies(activity, 3, ctx);

  expect(enemies).toHaveLength(3);

  expect(enemies).toIncludeAnyMembers([
    expect.objectContaining({ name: 'Enemy #1' }),
    expect.objectContaining({ name: 'Enemy #2' }),
    expect.objectContaining({ name: 'Enemy #3' }),
  ]);
});
