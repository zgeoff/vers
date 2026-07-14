import { expect, test } from 'bun:test';
import { buildStateFromSeed } from '@vers/game-utils';
import { createMockActivityInput } from '../test-utils/factories/create-mock-activity-input';
import { createMockAvatarData } from '../test-utils/factories/create-mock-avatar-data';
import { createMockEnemyData } from '../test-utils/factories/create-mock-enemy-data';
import { ActivityCheckpointType, ActivityFailureAction, ActivityType } from '../types';
import { runAttempt } from './run-attempt';

test('it commits a stream that starts and ends on a terminal checkpoint', async () => {
  const avatar = createMockAvatarData();

  const activity = createMockActivityInput({
    enemies: [createMockEnemyData()],
    id: 'world_map_encounter_1',
    seed: buildStateFromSeed(3_047_525_658),
    type: ActivityType.WorldMapEncounter,
  });

  const result = await runAttempt(activity, avatar, { maxDurationMs: 120_000 });

  expect(result.outcome).toBe('completed');
  expect(result.checkpoints[0]?.type).toBe(ActivityCheckpointType.Started);
  expect(result.checkpoints.at(-1)?.type).toBe(ActivityCheckpointType.Completed);
  expect(result.elapsed).toBeWithin(1, 120_001);
});

test('it is deterministic for a fixed seed', async () => {
  const activity = createMockActivityInput({
    enemies: [createMockEnemyData()],
    id: 'world_map_encounter_1',
    seed: buildStateFromSeed(3_047_525_658),
    type: ActivityType.WorldMapEncounter,
  });

  const first = await runAttempt(activity, createMockAvatarData(), { maxDurationMs: 120_000 });
  const second = await runAttempt(activity, createMockAvatarData(), { maxDurationMs: 120_000 });

  expect(second).toStrictEqual(first);
});

test('it stops at the first failure and never restarts within the attempt', async () => {
  // life 1 dies immediately, and Retry must not matter: retrying is the caller's loop
  const avatar = createMockAvatarData({ life: 1 });

  const activity = createMockActivityInput({
    enemies: [createMockEnemyData()],
    failureAction: ActivityFailureAction.Retry,
    id: 'world_map_encounter_1',
    seed: buildStateFromSeed(3_047_525_658),
    type: ActivityType.WorldMapEncounter,
  });

  const result = await runAttempt(activity, avatar, { maxDurationMs: 120_000 });

  const startedCheckpoints = result.checkpoints.filter(
    (checkpoint) => checkpoint.type === ActivityCheckpointType.Started,
  );

  expect(result.outcome).toBe('failed');
  expect(startedCheckpoints).toHaveLength(1);
  expect(result.checkpoints.at(-1)?.type).toBe(ActivityCheckpointType.Failed);
});

test('it discards the whole attempt when no terminal lands inside the budget', async () => {
  const avatar = createMockAvatarData();

  const activity = createMockActivityInput({
    enemies: [createMockEnemyData()],
    id: 'world_map_encounter_1',
    seed: buildStateFromSeed(3_047_525_658),
    type: ActivityType.WorldMapEncounter,
  });

  const result = await runAttempt(activity, avatar, { maxDurationMs: 1000 });

  expect(result.outcome).toBe('exceeded-budget');
  expect(result.checkpoints).toBeEmpty();
});
