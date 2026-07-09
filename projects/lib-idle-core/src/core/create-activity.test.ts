import { expect, test } from 'bun:test';
import { createMockActivityData } from '../test-utils/create-mock-activity-data';
import { createMockSimulationContext } from '../test-utils/create-mock-simulation-context';
import type { EnemyGroup } from '../types';
import { createActivity } from './create-activity';

test('it creates an activity with a fixed amount of groups', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData();

  const activity = createActivity(activityData, ctx, {
    groupCount: 3,
  });

  expect(activity.enemyGroups).toHaveLength(3);
});

test('it creates an activity with a fixed size for each group', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData();

  const activity = createActivity(activityData, ctx, {
    groupSize: 3,
  });

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  expect(activity.enemyGroups).toSatisfyAll((group: EnemyGroup) => group.enemies.length === 3);
});

test('it returns the expected activity state for a client app', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);

  const state = activity.getAppState();

  expect(state).toStrictEqual({
    currentEnemyGroup: {
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
      enemies: expect.any(Array),
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
      id: expect.any(String),
    },
    elapsed: 0,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    enemiesRemaining: expect.any(Number),
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    enemyGroups: expect.any(Array),
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    enemyGroupsRemaining: expect.any(Number),
    id: activity.id,
    name: activity.name,
  });
});
