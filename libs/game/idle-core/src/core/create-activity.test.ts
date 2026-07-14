import { expect, test } from 'bun:test';
import { createMockActivityInput } from '../test-utils/factories/create-mock-activity-input';
import { createMockSimulationContext } from '../test-utils/factories/create-mock-simulation-context';
import type { Wave } from '../types';
import { createActivity } from './create-activity';

test('it creates an activity with a fixed amount of waves', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityInput();

  const activity = createActivity(activityData, ctx, {
    waveCount: 3,
  });

  expect(activity.waves).toHaveLength(3);
});

test('it creates an activity with a fixed size for each wave', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityInput();

  const activity = createActivity(activityData, ctx, {
    waveSize: 3,
  });

  expect(activity.waves).toSatisfyAll((wave: Wave) => wave.enemies.length === 3);
});

test('it returns the expected activity state for a client app', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityInput();
  const activity = createActivity(activityData, ctx);
  const state = activity.getSnapshot();

  expect(state).toStrictEqual({
    currentWave: {
      enemies: expect.toBeArray(),
      id: expect.toBeString(),
    },
    elapsed: 0,
    enemiesRemaining: expect.toBeNumber(),
    id: activity.id,
    levelUp: null,
    name: activity.name,
    rewards: { xp: 0 },
    waves: expect.toBeArray(),
    wavesRemaining: expect.toBeNumber(),
  });
});

test('it accrues rewards across multiple calls', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityInput();
  const activity = createActivity(activityData, ctx);

  activity.updateRewards({ xp: 10 });
  activity.updateRewards({ xp: 5 });

  expect(activity.rewards).toStrictEqual({ xp: 15 });
  expect(activity.getSnapshot().rewards).toStrictEqual({ xp: 15 });
});

test('it exposes the difficulty carried by its activity data', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityInput({ difficulty: 2.5 });
  const activity = createActivity(activityData, ctx);

  expect(activity.difficulty).toBe(2.5);
});

test('it records a level-up event and surfaces it on app state', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityInput();
  const activity = createActivity(activityData, ctx);

  expect(activity.levelUp).toBeNull();

  activity.setLevelUp({ from: 1, to: 2 });

  expect(activity.levelUp).toStrictEqual({ from: 1, to: 2 });
  expect(activity.getSnapshot().levelUp).toStrictEqual({ from: 1, to: 2 });
});
