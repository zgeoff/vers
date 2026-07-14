import { expect, test } from 'bun:test';
import { createMockActivityInput } from '../../test-utils/factories/create-mock-activity-input';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import type { Wave } from '../../types';
import { getWaves } from './get-waves';

test('it returns waves of the specified size', () => {
  const activity = createMockActivityInput();
  const ctx = createMockSimulationContext();
  const waves = getWaves(activity, ctx, { waveSize: 3 });

  expect(waves).toSatisfyAll((wave: Wave) => wave.enemies.length === 3);
});

test('it returns the specified number of waves', () => {
  const activity = createMockActivityInput();
  const ctx = createMockSimulationContext();
  const waves = getWaves(activity, ctx, { waveCount: 3 });

  expect(waves).toHaveLength(3);
});
