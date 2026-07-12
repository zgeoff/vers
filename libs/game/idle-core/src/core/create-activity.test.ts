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

  expect(activity.enemyGroups).toSatisfyAll((group: EnemyGroup) => group.enemies.length === 3);
});

test('it returns the expected activity state for a client app', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);
  const state = activity.getAppState();

  expect(state).toStrictEqual({
    currentEnemyGroup: {
      enemies: expect.toBeArray(),
      id: expect.toBeString(),
    },
    elapsed: 0,
    enemiesRemaining: expect.toBeNumber(),
    enemyGroups: expect.toBeArray(),
    enemyGroupsRemaining: expect.toBeNumber(),
    id: activity.id,
    levelUp: null,
    name: activity.name,
    rewards: { xp: 0 },
  });
});

test('it accrues rewards across multiple calls', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);

  activity.updateRewards({ xp: 10 });
  activity.updateRewards({ xp: 5 });

  expect(activity.rewards).toStrictEqual({ xp: 15 });
  expect(activity.getAppState().rewards).toStrictEqual({ xp: 15 });
});

test('it exposes the difficulty carried by its activity data', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData({ difficulty: 2.5 });
  const activity = createActivity(activityData, ctx);

  expect(activity.difficulty).toBe(2.5);
});

test('it records a level-up event and surfaces it on app state', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);

  expect(activity.levelUp).toBeNull();

  activity.setLevelUp({ from: 1, to: 2 });

  expect(activity.levelUp).toStrictEqual({ from: 1, to: 2 });
  expect(activity.getAppState().levelUp).toStrictEqual({ from: 1, to: 2 });
});
