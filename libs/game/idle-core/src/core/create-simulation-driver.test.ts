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

  const oneShotResult = await oneShot.advanceToDuration(80_000);

  const split = createSimulationDriver(activity, avatar);

  const first = await split.advanceToDuration(20_000);
  const second = await split.advanceToDuration(50_000);
  const third = await split.advanceToDuration(80_000);

  expect([...first.checkpoints, ...second.checkpoints, ...third.checkpoints]).toStrictEqual(
    oneShotResult.checkpoints,
  );

  expect(split.elapsed).toBe(oneShot.elapsed);
  expect(split.rngState).toBe(oneShot.rngState);
});

test('it does not lose a checkpoint whose tick lands exactly on the duration boundary', async () => {
  const avatar = createMockAvatarData();

  const activity = createMockActivityInput({
    enemies: [createMockEnemyData()],
    failureAction: ActivityFailureAction.Retry,
    id: 'world_map_encounter_1',
    seed: buildStateFromSeed(3_047_525_658),
    type: ActivityType.WorldMapEncounter,
  });

  const oneShot = createSimulationDriver(activity, avatar);

  const oneShotResult = await oneShot.advanceToDuration(80_000);

  for (let count = 1; count < oneShotResult.checkpoints.length; count++) {
    const probe = createSimulationDriver(activity, avatar);

    await probe.advanceToDuration(80_000, undefined, count);

    const boundary = probe.elapsed;
    const split = createSimulationDriver(activity, avatar);

    const first = await split.advanceToDuration(boundary);
    const second = await split.advanceToDuration(80_000);

    expect([...first.checkpoints, ...second.checkpoints]).toStrictEqual(oneShotResult.checkpoints);
  }
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

  expect(first.checkpoints).toHaveLength(1);
  expect(first.checkpoints[0]?.type).toBe(ActivityCheckpointType.Started);

  const second = await driver.advanceToDuration(5000);

  expect(second.checkpoints).toBeEmpty();
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

  const result = await driver.advanceToDuration(200_000, '20c0dac3c8da96ee1a82332c38c2e8ae');

  expect(result.checkpoints.at(-1)).toStrictEqual({
    nextSeed: '20c0dac3c8da96ee1a82332c38c2e8ae',
    rewards: expect.toBeObject(),
    rewardSlots: expect.toBeArray(),
    time: expect.toBeNumber(),
    type: ActivityCheckpointType.Progress,
  });
});

test('it emits a zero-consumption checkpoint rather than halting on it before the first tick', async () => {
  const avatar = createMockAvatarData();

  const activity = createMockActivityInput({
    enemies: [createMockEnemyData()],
    failureAction: ActivityFailureAction.Abort,
    id: 'world_map_encounter_1',
    seed: buildStateFromSeed(3_047_525_658),
    type: ActivityType.WorldMapEncounter,
  });

  const driver = createSimulationDriver(activity, avatar);

  // The Started checkpoint's nextSeed equals the driver's rngState before any tick — a target
  // set to that same state must not stop the call before it emits the checkpoint.
  const result = await driver.advanceToDuration(200_000, driver.rngState, 1);

  expect(result.checkpoints).toHaveLength(1);
  expect(result.checkpoints[0]?.type).toBe(ActivityCheckpointType.Started);
});

test('it does not halt a resumed advance immediately when the resume state already equals stopAtState', async () => {
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

  const resumeState = driver.rngState;

  const result = await driver.advanceToDuration(200_000, resumeState, 1);

  expect(result.checkpoints).toHaveLength(1);
});

test('it reports the duration cap tripped when it stops short of the expected count', async () => {
  const avatar = createMockAvatarData();

  const activity = createMockActivityInput({
    enemies: [createMockEnemyData()],
    failureAction: ActivityFailureAction.Retry,
    id: 'world_map_encounter_1',
    seed: buildStateFromSeed(3_047_525_658),
    type: ActivityType.WorldMapEncounter,
  });

  const driver = createSimulationDriver(activity, avatar);

  const result = await driver.advanceToDuration(50, undefined, 5);

  expect(result.checkpoints).toHaveLength(1);
  expect(result.haltedOnDurationCap).toBeTrue();
});

test('it does not report the duration cap tripped when the expected count is reached', async () => {
  const avatar = createMockAvatarData();

  const activity = createMockActivityInput({
    enemies: [createMockEnemyData()],
    failureAction: ActivityFailureAction.Retry,
    id: 'world_map_encounter_1',
    seed: buildStateFromSeed(3_047_525_658),
    type: ActivityType.WorldMapEncounter,
  });

  const driver = createSimulationDriver(activity, avatar);

  const result = await driver.advanceToDuration(200_000, undefined, 1);

  expect(result.checkpoints).toHaveLength(1);
  expect(result.haltedOnDurationCap).toBeFalse();
});

test('it returns immediately without hanging on a later advance after an aborted failure', async () => {
  const avatar = createMockAvatarData({ life: 1 });
  const enemy = createMockEnemyData();

  const activity = createMockActivityInput({
    enemies: [enemy],
    failureAction: ActivityFailureAction.Abort,
    id: 'world_map_encounter_1',
    seed: buildStateFromSeed(3_047_525_658),
    type: ActivityType.WorldMapEncounter,
  });

  const driver = createSimulationDriver(activity, avatar);

  const first = await driver.advanceToDuration(100_000);

  expect(first.checkpoints.at(-1)?.type).toBe(ActivityCheckpointType.Failed);

  const second = await driver.advanceToDuration(200_000);

  expect(second.checkpoints).toBeEmpty();
});
