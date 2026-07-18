import { expect, test } from 'bun:test';
import { createMockActivityInput } from '../../test-utils/factories/create-mock-activity-input';
import { createMockEnemyData } from '../../test-utils/factories/create-mock-enemy-data';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import type { Wave } from '../../types';
import { getWaves } from './get-waves';

test('it returns one wave per wave the encounter defines, with its enemies', () => {
  const enemyData = createMockEnemyData();

  const activity = createMockActivityInput({
    encounter: {
      waves: [
        Array.from({ length: 3 }, () => enemyData),
        Array.from({ length: 3 }, () => enemyData),
      ],
    },
  });

  const ctx = createMockSimulationContext();
  const waves = getWaves(activity, ctx);

  expect(waves).toHaveLength(2);
  expect(waves).toSatisfyAll((wave: Wave) => wave.enemies.length === 3);
});

test('it derives each wave id from its position in the encounter', () => {
  const enemyData = createMockEnemyData();

  const activity = createMockActivityInput({
    encounter: { waves: [[enemyData], [enemyData], [enemyData]] },
  });

  const ctx = createMockSimulationContext();
  const waves = getWaves(activity, ctx);

  expect(waves.map((wave) => wave.id)).toStrictEqual(['wave-0', 'wave-1', 'wave-2']);
});
