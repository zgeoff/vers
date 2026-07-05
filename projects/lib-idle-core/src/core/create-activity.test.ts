import type { EnemyGroup } from 'src/types';
import { expect, test } from 'vitest';
import { createMockActivityData } from '../test-utils/create-mock-activity-data';
import { createMockSimulationContext } from '../test-utils/create-mock-simulation-context';
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

  expect(activity.enemyGroups).toSatisfyAll((group: EnemyGroup) => group.enemies.length === 3);
});

test('it returns the expected activity state for a client app', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);

  const state = activity.getAppState();

  expect(state).toStrictEqual({
    currentEnemyGroup: {
      enemies: expect.any(Array),
      id: expect.any(String),
    },
    elapsed: 0,
    enemiesRemaining: expect.any(Number),
    enemyGroups: expect.any(Array),
    enemyGroupsRemaining: expect.any(Number),
    id: activity.id,
    name: activity.name,
  });
});
