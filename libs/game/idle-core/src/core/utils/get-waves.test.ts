import { expect, test } from 'bun:test';
import { createMockActivityData } from '../../test-utils/create-mock-activity-data';
import { createMockSimulationContext } from '../../test-utils/create-mock-simulation-context';
import type { Wave } from '../../types';
import { getWaves } from './get-waves';

test('it returns waves of the specified size', () => {
  const activity = createMockActivityData();
  const ctx = createMockSimulationContext();
  const waves = getWaves(activity, ctx, { waveSize: 3 });

  expect(waves).toSatisfyAll((wave: Wave) => wave.enemies.length === 3);
});

test('it returns the specified number of waves', () => {
  const activity = createMockActivityData();
  const ctx = createMockSimulationContext();
  const waves = getWaves(activity, ctx, { waveCount: 3 });

  expect(waves).toHaveLength(3);
});
