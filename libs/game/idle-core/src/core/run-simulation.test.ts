import { expect, test } from 'bun:test';
import { buildStateFromSeed } from '@vers/game-utils';
import { createMockActivityInput } from '../test-utils/factories/create-mock-activity-input';
import { createMockAvatarData } from '../test-utils/factories/create-mock-avatar-data';
import { createMockEnemyData } from '../test-utils/factories/create-mock-enemy-data';
import { ActivityCheckpointType, ActivityFailureAction, ActivityType } from '../types';
import { runSimulation } from './run-simulation';

test('it runs a simulation to completion with the default configuration', async () => {
  const avatar = createMockAvatarData();

  const activity = createMockActivityInput({
    encounter: {
      waves: [
        Array.from({ length: 6 }, () => createMockEnemyData()),
        Array.from({ length: 6 }, () => createMockEnemyData()),
        Array.from({ length: 3 }, () => createMockEnemyData()),
        Array.from({ length: 4 }, () => createMockEnemyData()),
      ],
    },
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
          "nextSeed": "ffffffff4a5a72e5b5a58d1a00000000",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "ffffffff4a5a72e5b5a58d1a00000000",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "5468a77edf984ec079995dfd698938b2",
          "rewardSlots": [
            {
              "context": {
                "nodeTier": 1,
              },
              "ordinal": 0,
            },
            {
              "context": {
                "nodeTier": 1,
              },
              "ordinal": 1,
            },
            {
              "context": {
                "nodeTier": 1,
              },
              "ordinal": 2,
            },
            {
              "context": {
                "nodeTier": 1,
              },
              "ordinal": 3,
            },
            {
              "context": {
                "nodeTier": 1,
              },
              "ordinal": 4,
            },
            {
              "context": {
                "nodeTier": 1,
              },
              "ordinal": 5,
            },
          ],
          "rewards": {
            "xp": 60,
          },
          "time": 21250,
          "type": "progress",
        },
        {
          "levelUp": {
            "from": 1,
            "to": 2,
          },
          "nextSeed": "86c008c1cb5d97968d4554750eefc5d4",
          "rewardSlots": [
            {
              "context": {
                "nodeTier": 1,
              },
              "ordinal": 0,
            },
            {
              "context": {
                "nodeTier": 1,
              },
              "ordinal": 1,
            },
            {
              "context": {
                "nodeTier": 1,
              },
              "ordinal": 2,
            },
            {
              "context": {
                "nodeTier": 1,
              },
              "ordinal": 3,
            },
            {
              "context": {
                "nodeTier": 1,
              },
              "ordinal": 4,
            },
            {
              "context": {
                "nodeTier": 1,
              },
              "ordinal": 5,
            },
          ],
          "rewards": {
            "xp": 60,
          },
          "time": 38750,
          "type": "progress",
        },
        {
          "nextSeed": "f8e88eca342f7fe8bd8ab666f4b8bb62",
          "rewardSlots": [
            {
              "context": {
                "nodeTier": 1,
              },
              "ordinal": 0,
            },
            {
              "context": {
                "nodeTier": 1,
              },
              "ordinal": 1,
            },
            {
              "context": {
                "nodeTier": 1,
              },
              "ordinal": 2,
            },
          ],
          "rewards": {
            "xp": 30,
          },
          "time": 48750,
          "type": "progress",
        },
        {
          "nextSeed": "664be6d955fc249bfe89a1dbcdfd99cc",
          "rewardSlots": [
            {
              "context": {
                "nodeTier": 1,
              },
              "ordinal": 0,
            },
            {
              "context": {
                "nodeTier": 1,
              },
              "ordinal": 1,
            },
            {
              "context": {
                "nodeTier": 1,
              },
              "ordinal": 2,
            },
            {
              "context": {
                "nodeTier": 1,
              },
              "ordinal": 3,
            },
          ],
          "rewards": {
            "xp": 40,
          },
          "time": 61250,
          "type": "progress",
        },
        {
          "nextSeed": "664be6d955fc249bfe89a1dbcdfd99cc",
          "rewardSlots": [],
          "rewards": {
            "xp": 215,
          },
          "time": 61250,
          "type": "completed",
        },
        {
          "nextSeed": "664be6d955fc249bfe89a1dbcdfd99cc",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "664be6d955fc249bfe89a1dbcdfd99cc",
          "time": 0,
          "type": "started",
        },
      ],
      "elapsed": 80000,
    }
  `);
});

test('it respects duration limit and stops the simulation accordingly', async () => {
  const avatar = createMockAvatarData();

  const activity = createMockActivityInput({
    encounter: {
      waves: [
        Array.from({ length: 6 }, () => createMockEnemyData()),
        Array.from({ length: 6 }, () => createMockEnemyData()),
        Array.from({ length: 3 }, () => createMockEnemyData()),
        Array.from({ length: 4 }, () => createMockEnemyData()),
      ],
    },
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
    encounter: {
      waves: [
        Array.from({ length: 6 }, () => enemy),
        Array.from({ length: 6 }, () => enemy),
        Array.from({ length: 3 }, () => enemy),
        Array.from({ length: 4 }, () => enemy),
      ],
    },
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
    stopAtState: '5468a77edf984ec079995dfd698938b2',
  };

  const result = await runSimulation(activity, avatar, config);

  const [finalCheckpoint] = result.checkpoints.slice(-1);

  expect(finalCheckpoint).toStrictEqual({
    nextSeed: config.stopAtState,
    rewards: expect.toBeObject(),
    rewardSlots: expect.toBeArray(),
    time: expect.toBeNumber(),
    type: ActivityCheckpointType.Progress,
  });
});

test('it aborts on failure if failure action is set to abort', async () => {
  // set our life to 1 so we die immediately
  const avatar = createMockAvatarData({ life: 1 });
  const enemy = createMockEnemyData();

  const activity = createMockActivityInput({
    encounter: {
      waves: [
        Array.from({ length: 6 }, () => enemy),
        Array.from({ length: 6 }, () => enemy),
        Array.from({ length: 3 }, () => enemy),
        Array.from({ length: 4 }, () => enemy),
      ],
    },
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
    rewardSlots: [],
    time: expect.toBeNumber(),
    type: ActivityCheckpointType.Failed,
  });
});

test('it retries when failure action is set to retry', async () => {
  // set our life to 1 so we die immediately
  const avatar = createMockAvatarData({ life: 1 });
  const enemy = createMockEnemyData();

  const activity = createMockActivityInput({
    encounter: {
      waves: [
        Array.from({ length: 6 }, () => enemy),
        Array.from({ length: 6 }, () => enemy),
        Array.from({ length: 3 }, () => enemy),
        Array.from({ length: 4 }, () => enemy),
      ],
    },
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
