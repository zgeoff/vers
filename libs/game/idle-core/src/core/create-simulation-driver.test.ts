import { expect, test } from 'bun:test';
import { buildStateFromSeed } from '@vers/game-utils';
import { createMockActivityInput } from '../test-utils/factories/create-mock-activity-input';
import { createMockAvatarData } from '../test-utils/factories/create-mock-avatar-data';
import { createMockEnemyData } from '../test-utils/factories/create-mock-enemy-data';
import { ActivityCheckpointType, ActivityFailureAction, ActivityType } from '../types';
import { createSimulationDriver } from './create-simulation-driver';

test('it emits the same checkpoint sequence in one advance as split across several', async () => {
  const avatar = createMockAvatarData();

  const activity = createMockActivityInput({
    enemies: [createMockEnemyData()],
    failureAction: ActivityFailureAction.Retry,
    id: 'world_map_encounter_1',
    seed: buildStateFromSeed(3_047_525_658),
    type: ActivityType.WorldMapEncounter,
  });

  const oneShot = createSimulationDriver(activity, avatar);

  const oneShotCheckpoints = await oneShot.advanceToDuration(80_000);

  const split = createSimulationDriver(activity, avatar);

  const first = await split.advanceToDuration(20_000);
  const second = await split.advanceToDuration(50_000);
  const third = await split.advanceToDuration(80_000);

  expect([...first, ...second, ...third]).toStrictEqual(oneShotCheckpoints);
  expect(split.elapsed).toBe(oneShot.elapsed);
  expect(split.rngState).toBe(oneShot.rngState);
});

test('it advances an idle batch with no boundary-crossing checkpoints', async () => {
  const avatar = createMockAvatarData();

  const activity = createMockActivityInput({
    enemies: [createMockEnemyData()],
    failureAction: ActivityFailureAction.Retry,
    id: 'world_map_encounter_1',
    seed: buildStateFromSeed(3_047_525_658),
    type: ActivityType.WorldMapEncounter,
  });

  const driver = createSimulationDriver(activity, avatar);

  const first = await driver.advanceToDuration(50);

  expect(first).toHaveLength(1);
  expect(first[0]?.type).toBe(ActivityCheckpointType.Started);

  const second = await driver.advanceToDuration(5000);

  expect(second).toBeEmpty();
  expect(driver.elapsed).toBe(5000);
});

test('it stops at the specified rng state within a later advance', async () => {
  const avatar = createMockAvatarData();

  const activity = createMockActivityInput({
    enemies: [createMockEnemyData()],
    failureAction: ActivityFailureAction.Retry,
    id: 'world_map_encounter_1',
    seed: buildStateFromSeed(3_047_525_658),
    type: ActivityType.WorldMapEncounter,
  });

  const driver = createSimulationDriver(activity, avatar);

  await driver.advanceToDuration(5000);

  const checkpoints = await driver.advanceToDuration(200_000, '20c0dac3c8da96ee1a82332c38c2e8ae');

  expect(checkpoints.at(-1)).toStrictEqual({
    nextSeed: '20c0dac3c8da96ee1a82332c38c2e8ae',
    rewards: expect.toBeObject(),
    time: expect.toBeNumber(),
    type: ActivityCheckpointType.Progress,
  });
});
