import { expect, test } from 'vitest';
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

  const checkpoint = createProgressCheckpoint(activity, ctx);

  expect(checkpoint).toStrictEqual({
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    hash: expect.any(String),
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    nextSeed: expect.any(Number),
    time: 2500,
    type: ActivityCheckpointType.Progress,
  });
});

test('it includes a hash based on checkpoint data', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);

  activity.elapseTime(2500);

  const checkpoint = createProgressCheckpoint(activity, ctx);

  const { hash, ...hashParts } = checkpoint;

  expect(hash).toStrictEqual(hashObject(ctx.hasher, hashParts));
});
