import { expect, test } from 'bun:test';
import { createMockActivityData } from '../../test-utils/create-mock-activity-data';
import { createMockSimulationContext } from '../../test-utils/create-mock-simulation-context';
import { ActivityCheckpointType } from '../../types';
import { hashObject } from '../../utils/hash-object';
import { createActivity } from '../create-activity';
import { createFailedCheckpoint } from './create-failed-checkpoint';

test('it creates a failed checkpoint', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);

  activity.elapseTime(2500);

  const checkpoint = createFailedCheckpoint(activity, ctx);

  expect(checkpoint).toStrictEqual({
    hash: expect.toBeString(),
    nextSeed: expect.toBeNumber(),
    rewards: { xp: 0 },
    time: 2500,
    type: ActivityCheckpointType.Failed,
  });
});

test('it includes a hash based on checkpoint data', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);
  const checkpoint = createFailedCheckpoint(activity, ctx);
  const { hash, rewards, ...hashParts } = checkpoint;

  expect(hash).toStrictEqual(hashObject(ctx.hasher, hashParts));
});
