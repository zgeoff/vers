import { expect, test } from 'vitest';
import { createMockActivityData } from '../../test-utils/create-mock-activity-data';
import { createMockSimulationContext } from '../../test-utils/create-mock-simulation-context';
import type { EnemyGroup } from '../../types';
import { getEnemyGroups } from './get-enemy-groups';

test('it returns groups of the specified size', () => {
  const activity = createMockActivityData();
  const ctx = createMockSimulationContext();

  const groups = getEnemyGroups(activity, ctx, { groupSize: 3 });

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  expect(groups).toSatisfyAll((group: EnemyGroup) => group.enemies.length === 3);
});

test('it returns the specified number of groups', () => {
  const activity = createMockActivityData();
  const ctx = createMockSimulationContext();

  const groups = getEnemyGroups(activity, ctx, { groupCount: 3 });

  expect(groups).toHaveLength(3);
});
