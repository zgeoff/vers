import { expect, test } from 'bun:test';
import { createMockActivityData } from '../../test-utils/create-mock-activity-data';
import { createMockSimulationContext } from '../../test-utils/create-mock-simulation-context';
import { ActivityCheckpointType } from '../../types';
import { hashObject } from '../../utils/hash-object';
import { createActivity } from '../create-activity';
import { createProgressCheckpoint } from './create-progress-checkpoint';

test('it creates a progress checkpoint', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);

  activity.elapseTime(2500);

  const checkpoint = createProgressCheckpoint(activity, ctx, { xp: 15 });

  expect(checkpoint).toStrictEqual({
    hash: expect.toBeString(),
    nextSeed: expect.toBeNumber(),
    rewards: { xp: 15 },
    time: 2500,
    type: ActivityCheckpointType.Progress,
  });
});

test('it includes a hash based on checkpoint data', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);

  activity.elapseTime(2500);

  const checkpoint = createProgressCheckpoint(activity, ctx, { xp: 15 });
  const { hash, rewards, ...hashParts } = checkpoint;

  expect(hash).toStrictEqual(hashObject(ctx.hasher, hashParts));
});

test('it produces the same hash for checkpoints that differ only by rewards', () => {
  const activityData = createMockActivityData();
  const ctxWithNoRewards = createMockSimulationContext();
  const activityWithNoRewards = createActivity(activityData, ctxWithNoRewards);

  activityWithNoRewards.elapseTime(2500);

  const withNoRewards = createProgressCheckpoint(activityWithNoRewards, ctxWithNoRewards, {
    xp: 0,
  });

  const ctxWithRewards = createMockSimulationContext();
  const activityWithRewards = createActivity(activityData, ctxWithRewards);

  activityWithRewards.elapseTime(2500);

  const withRewards = createProgressCheckpoint(activityWithRewards, ctxWithRewards, { xp: 15 });

  expect(withRewards.hash).toStrictEqual(withNoRewards.hash);
});
