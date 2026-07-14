import { expect, test } from 'bun:test';
import { buildStateFromSeed } from '@vers/game-utils';
import { createMockActivityInput } from '../test-utils/create-mock-activity-input';
import { createMockAvatarData } from '../test-utils/create-mock-avatar-data';
import { createMockEnemyData } from '../test-utils/create-mock-enemy-data';
import { ActivityCheckpointType, ActivityFailureAction, ActivityType } from '../types';
import { runSimulation } from './run-simulation';

test('runs a simulation with default configuration', async () => {
  const avatar = createMockAvatarData();

  const activity = createMockActivityInput({
    enemies: [createMockEnemyData()],
    failureAction: ActivityFailureAction.Retry,
    id: 'world_map_encounter_1',
    seed: buildStateFromSeed(3_047_525_658),
    type: ActivityType.WorldMapEncounter,
  });

  const config = {
    duration: 80_000,
  };

  const result = await runSimulation(activity, avatar, config);

  expect(result).toMatchInlineSnapshot(`
    {
      "checkpoints": [
        {
          "nextSeed": "63298078c2177576c07e0321584c2a05",
          "rewards": {
            "xp": 0,
          },
          "seed": "63298078c2177576c07e0321584c2a05",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "20c0dac3c8da96ee1a82332c38c2e8ae",
          "rewards": {
            "xp": 60,
          },
          "time": 16250,
          "type": "progress",
        },
        {
          "levelUp": {
            "from": 1,
            "to": 2,
          },
          "nextSeed": "651b7bac24e8282ac2345557ee733dc5",
          "rewards": {
            "xp": 60,
          },
          "time": 33750,
          "type": "progress",
        },
        {
          "nextSeed": "183a8b662f0c22f40b637a9f83c410ca",
          "rewards": {
            "xp": 30,
          },
          "time": 43750,
          "type": "progress",
        },
        {
          "nextSeed": "0d1c5f2ed8a45260129c426ab502cbb3",
          "rewards": {
            "xp": 40,
          },
          "time": 56250,
          "type": "progress",
        },
        {
          "nextSeed": "0d1c5f2ed8a45260129c426ab502cbb3",
          "rewards": {
            "xp": 215,
          },
          "time": 56250,
          "type": "completed",
        },
        {
          "nextSeed": "664be6d955fc249bfe89a1dbcdfd99cc",
          "rewards": {
            "xp": 0,
          },
          "seed": "664be6d955fc249bfe89a1dbcdfd99cc",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "dd5a3353a7f6c0c6afcb296684176982",
          "rewards": {
            "xp": 40,
          },
          "time": 13750,
          "type": "progress",
        },
      ],
      "elapsed": 80000,
    }
  `);
});

test('it respects duration limit and stops the simulation accordingly', async () => {
  const avatar = createMockAvatarData();

  const activity = createMockActivityInput({
    enemies: [createMockEnemyData()],
    failureAction: ActivityFailureAction.Retry,
    id: 'world_map_encounter_1',
    seed: buildStateFromSeed(3_047_525_658),
    type: ActivityType.WorldMapEncounter,
  });

  const config = {
    // the first wave is killed at ~17 seconds on this seed
    duration: 10_000,
  };

  const result = await runSimulation(activity, avatar, config);

  expect(result.checkpoints).toHaveLength(1);
  expect(result.checkpoints[0]?.type).toBe(ActivityCheckpointType.Started);
  expect(result.elapsed).toBe(10_000);
});

test('it stops at the specified rng state if provided', async () => {
  const avatar = createMockAvatarData();
  const enemy = createMockEnemyData();

  const activity = createMockActivityInput({
    enemies: [enemy],
    failureAction: ActivityFailureAction.Retry,
    id: 'world_map_encounter_1',
    seed: buildStateFromSeed(3_047_525_658),
    type: ActivityType.WorldMapEncounter,
  });

  const config = {
    // set a long duration so we always reach the right value
    duration: 200_000,

    // when our algo changes, can just pull this state to something valid from our
    // happy path snapshot test ouput
    stopAtState: '20c0dac3c8da96ee1a82332c38c2e8ae',
  };

  const result = await runSimulation(activity, avatar, config);

  const [finalCheckpoint] = result.checkpoints.slice(-1);

  expect(finalCheckpoint).toStrictEqual({
    nextSeed: config.stopAtState,
    rewards: expect.toBeObject(),
    time: expect.toBeNumber(),
    type: ActivityCheckpointType.Progress,
  });
});

test('it aborts on failure if failure action is set to abort', async () => {
  // set our life to 1 so we die immediately
  const avatar = createMockAvatarData({ life: 1 });
  const enemy = createMockEnemyData();

  const activity = createMockActivityInput({
    enemies: [enemy],
    failureAction: ActivityFailureAction.Abort,
    id: 'world_map_encounter_1',
    seed: buildStateFromSeed(3_047_525_658),
    type: ActivityType.WorldMapEncounter,
  });

  const config = {
    duration: 100_000,
  };

  const result = await runSimulation(activity, avatar, config);

  const failedCheckpoints = result.checkpoints.filter(
    (cp) => cp.type === ActivityCheckpointType.Failed,
  );

  expect(failedCheckpoints).toHaveLength(1);

  const lastCheckpoint = result.checkpoints.at(-1);

  expect(lastCheckpoint).toStrictEqual({
    nextSeed: expect.toBeString(),
    rewards: { xp: 0 },
    time: expect.toBeNumber(),
    type: ActivityCheckpointType.Failed,
  });
});

test('it retries when failure action is set to retry', async () => {
  // set our life to 1 so we die immediately
  const avatar = createMockAvatarData({ life: 1 });
  const enemy = createMockEnemyData();

  const activity = createMockActivityInput({
    enemies: [enemy],
    failureAction: ActivityFailureAction.Retry,
    id: 'world_map_encounter_1',
    seed: buildStateFromSeed(3_047_525_658),
    type: ActivityType.WorldMapEncounter,
  });

  const config = {
    duration: 10_000,
  };

  const result = await runSimulation(activity, avatar, config);

  const failedCheckpoints = result.checkpoints.filter(
    (cp) => cp.type === ActivityCheckpointType.Failed,
  );

  expect(failedCheckpoints.length).toBeGreaterThan(1);
});
