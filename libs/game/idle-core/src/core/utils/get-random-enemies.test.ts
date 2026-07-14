import { expect, test } from 'bun:test';
import { createMockActivityInput } from '../../test-utils/factories/create-mock-activity-input';
import { createMockEnemyData } from '../../test-utils/factories/create-mock-enemy-data';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import { getRandomEnemies } from './get-random-enemies';

test('it returns as many enemies as requested', () => {
  const activity = createMockActivityInput();
  const ctx = createMockSimulationContext();
  const enemies = getRandomEnemies(activity, 3, ctx);

  expect(enemies).toHaveLength(3);
});

test('it gets a random assortment of enemies', () => {
  const enemyData1 = createMockEnemyData({ name: 'Enemy #1' });
  const enemyData2 = createMockEnemyData({ name: 'Enemy #2' });
  const enemyData3 = createMockEnemyData({ name: 'Enemy #3' });

  const activity = createMockActivityInput({
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
