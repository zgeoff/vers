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
          "nextSeed": "925d40c56a8f10e54ef3e9f98eb38e86",
          "rewardSlots": [],
          "rewards": {
            "xp": 10,
          },
          "time": 3750,
          "type": "progress",
        },
        {
          "nextSeed": "e65fab3e74a44904e05cae86162bc079",
          "rewardSlots": [],
          "rewards": {
            "xp": 10,
          },
          "time": 6250,
          "type": "progress",
        },
        {
          "nextSeed": "4bc36477e8a5f919adcf1ea4b53569e5",
          "rewardSlots": [],
          "rewards": {
            "xp": 10,
          },
          "time": 10000,
          "type": "progress",
        },
        {
          "nextSeed": "9d9e6262c60e3df50aef2a73ed10ef53",
          "rewardSlots": [],
          "rewards": {
            "xp": 10,
          },
          "time": 13750,
          "type": "progress",
        },
        {
          "nextSeed": "1065c3616078be9a030fc807485d3dfe",
          "rewardSlots": [],
          "rewards": {
            "xp": 10,
          },
          "time": 17500,
          "type": "progress",
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
            "xp": 10,
          },
          "time": 21250,
          "type": "progress",
        },
        {
          "nextSeed": "8a820a87275cb857fa968a30e570b8d6",
          "rewardSlots": [],
          "rewards": {
            "xp": 10,
          },
          "time": 23750,
          "type": "progress",
        },
        {
          "nextSeed": "0cfb61579d8e1e40e2f24da942f6dd6e",
          "rewardSlots": [],
          "rewards": {
            "xp": 10,
          },
          "time": 27500,
          "type": "progress",
        },
        {
          "nextSeed": "0675e7603f8155afc8c6a28d0c6d98e9",
          "rewardSlots": [],
          "rewards": {
            "xp": 10,
          },
          "time": 30000,
          "type": "progress",
        },
        {
          "levelUp": {
            "from": 1,
            "to": 2,
          },
          "nextSeed": "651b7bac24e8282ac2345557ee733dc5",
          "rewardSlots": [],
          "rewards": {
            "xp": 10,
          },
          "time": 33750,
          "type": "progress",
        },
        {
          "nextSeed": "ee1f24abfb2e8cf516ee1876f7df5a2b",
          "rewardSlots": [],
          "rewards": {
            "xp": 10,
          },
          "time": 36250,
          "type": "progress",
        },
        {
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
            "xp": 10,
          },
          "time": 38750,
          "type": "progress",
        },
        {
          "nextSeed": "b2e6283e120491eb7aa9dce8e71a5e01",
          "rewardSlots": [],
          "rewards": {
            "xp": 10,
          },
          "time": 41250,
          "type": "progress",
        },
        {
          "nextSeed": "22bdef44811f50085ecc5e2446812146",
          "rewardSlots": [],
          "rewards": {
            "xp": 10,
          },
          "time": 45000,
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
            "xp": 10,
          },
          "time": 48750,
          "type": "progress",
        },
        {
          "nextSeed": "ad82bf95e1470a5e9beb0ece1bdce383",
          "rewardSlots": [],
          "rewards": {
            "xp": 10,
          },
          "time": 52500,
          "type": "progress",
        },
        {
          "nextSeed": "49248a9017d0d3a1d2aea2bd9c601089",
          "rewardSlots": [],
          "rewards": {
            "xp": 10,
          },
          "time": 55000,
          "type": "progress",
        },
        {
          "nextSeed": "c688f22dc55631d58f65a03319fdda6c",
          "rewardSlots": [],
          "rewards": {
            "xp": 10,
          },
          "time": 57500,
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
            "xp": 10,
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
        {
          "nextSeed": "ccc3c6b398f52bb18c258dfdf86a6b7e",
          "rewardSlots": [],
          "rewards": {
            "xp": 10,
          },
          "time": 3750,
          "type": "progress",
        },
        {
          "nextSeed": "76b07ee326947d7008336ad64949f1b4",
          "rewardSlots": [],
          "rewards": {
            "xp": 10,
          },
          "time": 7500,
          "type": "progress",
        },
        {
          "nextSeed": "dca28ddc26b704b5d5fe773131dbf5bf",
          "rewardSlots": [],
          "rewards": {
            "xp": 10,
          },
          "time": 10000,
          "type": "progress",
        },
        {
          "nextSeed": "935fd82a5e083dfd65f59122900f7df6",
          "rewardSlots": [],
          "rewards": {
            "xp": 10,
          },
          "time": 13750,
          "type": "progress",
        },
        {
          "nextSeed": "c2277040706a943e5c6a48ba9890c928",
          "rewardSlots": [],
          "rewards": {
            "xp": 10,
          },
          "time": 16250,
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
    // the first enemy falls at ~3.75 seconds on this seed
    duration: 3000,
  };

  const result = await runSimulation(activity, avatar, config);

  expect(result.checkpoints).toHaveLength(1);
  expect(result.checkpoints[0]?.type).toBe(ActivityCheckpointType.Started);
  expect(result.elapsed).toBe(3000);
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
