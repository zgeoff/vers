import { expect, test } from 'bun:test';
import { buildStateFromSeed } from '@vers/game-utils';
import invariant from 'tiny-invariant';
import { buildSimulationInput } from './core/build-simulation-input';
import { createSimulationDriver } from './core/create-simulation-driver';
import { runAttempt } from './core/run-attempt';
import { ActivityFailureAction } from './types';

/**
 * Golden replay fixtures: literal simulation inputs run through the production derivation
 * (`buildSimulationInput`) and pinned as inline snapshots. An output-identical engine change
 * leaves every snapshot untouched; a deliberate simVersion bump regenerates them via
 * `bun test -u` and the diff is reviewed like any code change. Inputs are literals, never
 * factories — every field here determines the pinned stream.
 */

test('it replays a completed attempt to an identical checkpoint stream', async () => {
  const input = buildSimulationInput({
    avatarID: 'avatar-golden-completed',
    buildSnapshot: { level: 10, xp: 0 },
    contentVersion: '1',
    encounterNode: { difficulty: 1 },
    id: 'activity-golden-completed',
    seed: buildStateFromSeed(1_111_111),
  });

  const result = await runAttempt(input.activity, input.avatar, { maxDurationMs: 600_000 });

  expect(result).toMatchInlineSnapshot(`
    {
      "checkpoints": [
        {
          "nextSeed": "ffffffffffef0bb80010f44700000000",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "ffffffffffef0bb80010f44700000000",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "964b5a51d7ed6a504028276af605916c",
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
            "xp": 28,
          },
          "time": 10000,
          "type": "progress",
        },
        {
          "nextSeed": "dbf6b912f764c7bf1622e2c689dc6ac2",
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
            "xp": 26,
          },
          "time": 17500,
          "type": "progress",
        },
        {
          "nextSeed": "f9cb6472f1d9f3b273cd14df7a2695f2",
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
            "xp": 24,
          },
          "time": 25000,
          "type": "progress",
        },
        {
          "levelUp": {
            "from": 1,
            "to": 2,
          },
          "nextSeed": "cfc222316498a5228501305b2b1253b3",
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
            "xp": 34,
          },
          "time": 35000,
          "type": "progress",
        },
        {
          "nextSeed": "e5965522f63a455fbcc01a22595d64b9",
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
            "xp": 54,
          },
          "time": 51250,
          "type": "progress",
        },
        {
          "nextSeed": "1c4a3bcf245eaf477ca23c5770fb5190",
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
            "xp": 36,
          },
          "time": 62500,
          "type": "progress",
        },
        {
          "nextSeed": "1c4a3bcf245eaf477ca23c5770fb5190",
          "rewardSlots": [],
          "rewards": {
            "xp": 227,
          },
          "time": 62500,
          "type": "completed",
        },
      ],
      "elapsed": 62600,
      "outcome": "completed",
    }
  `);
});

test('it replays a failed attempt to an identical checkpoint stream', async () => {
  const input = buildSimulationInput({
    avatarID: 'avatar-golden-failed',
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: '1',
    encounterNode: { difficulty: 12 },
    id: 'activity-golden-failed',
    seed: buildStateFromSeed(2_222_222),
  });

  const result = await runAttempt(input.activity, input.avatar, { maxDurationMs: 600_000 });

  expect(result).toMatchInlineSnapshot(`
    {
      "checkpoints": [
        {
          "nextSeed": "ffffffffffde17710021e88e00000000",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "ffffffffffde17710021e88e00000000",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "336b5d111a74eb4c355b4ed8ee62e7a5",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 2900,
          "type": "failed",
        },
      ],
      "elapsed": 3000,
      "outcome": "failed",
    }
  `);
});

/**
 * This seed/difficulty/level combination's wave lands two enemies' attacks on the exact same
 * tick, and the first one applied kills the avatar before the second's damage roll draws from
 * the rng — the scenario `create-event-sorter.ts`'s executor-assigned sequence exists to order
 * deterministically. Reordering that tick's application changes how many draws the run consumes,
 * so this fixture's `nextSeed` pins the executor's schedule-order tie-break at the replay level,
 * not just the unit level.
 */
test('it replays a same-tick multi-enemy avatar-death stream to an identical checkpoint stream', async () => {
  const input = buildSimulationInput({
    avatarID: 'avatar-golden-divergence',
    buildSnapshot: { level: 2, xp: 0 },
    contentVersion: '1',
    encounterNode: { difficulty: 8 },
    id: 'activity-golden-divergence',
    seed: buildStateFromSeed(4),
  });

  const result = await runAttempt(input.activity, input.avatar, { maxDurationMs: 600_000 });

  expect(result).toMatchInlineSnapshot(`
    {
      "checkpoints": [
        {
          "nextSeed": "fffffffffffffffb0000000400000000",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "fffffffffffffffb0000000400000000",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "cae74db90a879eb757eb51948b1b6fdb",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 10000,
          "type": "failed",
        },
      ],
      "elapsed": 10100,
      "outcome": "failed",
    }
  `);
});

test('it replays a retrying multi-attempt stream to an identical checkpoint stream', async () => {
  const input = buildSimulationInput(
    {
      avatarID: 'avatar-golden-retry',
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: '1',
      encounterNode: { difficulty: 12 },
      id: 'activity-golden-retry',
      seed: buildStateFromSeed(3_333_333),
    },
    { failureAction: ActivityFailureAction.Retry },
  );

  const driver = createSimulationDriver(input.activity, input.avatar);

  const result = await driver.advanceToDuration(120_000);

  expect({ checkpoints: result.checkpoints, rngState: driver.rngState }).toMatchInlineSnapshot(`
    {
      "checkpoints": [
        {
          "nextSeed": "ffffffffffcd232a0032dcd500000000",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "ffffffffffcd232a0032dcd500000000",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "e2f6c85f7c3e615b848cbc6b90c0fed2",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 4000,
          "type": "failed",
        },
        {
          "nextSeed": "e2f6c85f7c3e615b848cbc6b90c0fed2",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "e2f6c85f7c3e615b848cbc6b90c0fed2",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "876b63e631336aab39ed89066ba8e901",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 6000,
          "type": "failed",
        },
        {
          "nextSeed": "876b63e631336aab39ed89066ba8e901",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "876b63e631336aab39ed89066ba8e901",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "b48f4ef63058faf85466cc87c7b6a6bb",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 6000,
          "type": "failed",
        },
        {
          "nextSeed": "b48f4ef63058faf85466cc87c7b6a6bb",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "b48f4ef63058faf85466cc87c7b6a6bb",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "7113010cb4448d5f0d884642c3a35039",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 6000,
          "type": "failed",
        },
        {
          "nextSeed": "7113010cb4448d5f0d884642c3a35039",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "7113010cb4448d5f0d884642c3a35039",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "a064865377d770677dbd08e4f7a766fe",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 6000,
          "type": "failed",
        },
        {
          "nextSeed": "a064865377d770677dbd08e4f7a766fe",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "a064865377d770677dbd08e4f7a766fe",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "d5f9300c16a7eba753ad63b2deee0b1b",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 6000,
          "type": "failed",
        },
        {
          "nextSeed": "d5f9300c16a7eba753ad63b2deee0b1b",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "d5f9300c16a7eba753ad63b2deee0b1b",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "6fa040fa4c999b666fb3a048a31916a4",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 6000,
          "type": "failed",
        },
        {
          "nextSeed": "6fa040fa4c999b666fb3a048a31916a4",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "6fa040fa4c999b666fb3a048a31916a4",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "16525c72b2b3abcd0758b58b41d0da7a",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 6000,
          "type": "failed",
        },
        {
          "nextSeed": "16525c72b2b3abcd0758b58b41d0da7a",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "16525c72b2b3abcd0758b58b41d0da7a",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "b7e9554620a7e3c9d140fb5c5e644419",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 6000,
          "type": "failed",
        },
        {
          "nextSeed": "b7e9554620a7e3c9d140fb5c5e644419",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "b7e9554620a7e3c9d140fb5c5e644419",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "9991099d9a3c605aaf297ebc75b7e5d8",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 4000,
          "type": "failed",
        },
        {
          "nextSeed": "9991099d9a3c605aaf297ebc75b7e5d8",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "9991099d9a3c605aaf297ebc75b7e5d8",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "f10d80b59a1015cfba99ed8ed50a75e9",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 6000,
          "type": "failed",
        },
        {
          "nextSeed": "f10d80b59a1015cfba99ed8ed50a75e9",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "f10d80b59a1015cfba99ed8ed50a75e9",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "33678f6fc0d1182ace67018bcf90c53c",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 4000,
          "type": "failed",
        },
        {
          "nextSeed": "33678f6fc0d1182ace67018bcf90c53c",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "33678f6fc0d1182ace67018bcf90c53c",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "3cac6402920275e1b9f8dccf342b0d1d",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 6000,
          "type": "failed",
        },
        {
          "nextSeed": "3cac6402920275e1b9f8dccf342b0d1d",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "3cac6402920275e1b9f8dccf342b0d1d",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "f61eb06b3ba430eaccf269a3c7db2b9c",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 6000,
          "type": "failed",
        },
        {
          "nextSeed": "f61eb06b3ba430eaccf269a3c7db2b9c",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "f61eb06b3ba430eaccf269a3c7db2b9c",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "456ec34b2b4df4d5e3517f3fe5fa61bc",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 6000,
          "type": "failed",
        },
        {
          "nextSeed": "456ec34b2b4df4d5e3517f3fe5fa61bc",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "456ec34b2b4df4d5e3517f3fe5fa61bc",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "c88b625cd8e33850b3c1a61f1b739f26",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 6000,
          "type": "failed",
        },
        {
          "nextSeed": "c88b625cd8e33850b3c1a61f1b739f26",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "c88b625cd8e33850b3c1a61f1b739f26",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "443465bd9a684a3a1f7cc6d79eabcb1a",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 4000,
          "type": "failed",
        },
        {
          "nextSeed": "443465bd9a684a3a1f7cc6d79eabcb1a",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "443465bd9a684a3a1f7cc6d79eabcb1a",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "719f5ad6cf23be3c4d9865af552102c0",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 4000,
          "type": "failed",
        },
        {
          "nextSeed": "719f5ad6cf23be3c4d9865af552102c0",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "719f5ad6cf23be3c4d9865af552102c0",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "01ac827123dcd3b2519af73c0346744a",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 4000,
          "type": "failed",
        },
        {
          "nextSeed": "01ac827123dcd3b2519af73c0346744a",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "01ac827123dcd3b2519af73c0346744a",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "fe60a43757b89176102b9b061d1a9209",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 6000,
          "type": "failed",
        },
        {
          "nextSeed": "fe60a43757b89176102b9b061d1a9209",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "fe60a43757b89176102b9b061d1a9209",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "325edfbc5ea1188296eeb2d4ff055b9e",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "time": 6000,
          "type": "failed",
        },
        {
          "nextSeed": "325edfbc5ea1188296eeb2d4ff055b9e",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "325edfbc5ea1188296eeb2d4ff055b9e",
          "time": 0,
          "type": "started",
        },
      ],
      "rngState": "547cf5d53a053c8f2962ecbd9a584989",
    }
  `);
});

test('it replays a multi-clear stream to an identical checkpoint stream', async () => {
  const input = buildSimulationInput({
    avatarID: 'avatar-golden-clears',
    buildSnapshot: { level: 10, xp: 0 },
    contentVersion: '1',
    encounterNode: { difficulty: 1 },
    id: 'activity-golden-clears',
    seed: buildStateFromSeed(4_444_444),
  });

  const driver = createSimulationDriver(input.activity, input.avatar);

  const result = await driver.advanceToDuration(120_000);

  expect({ checkpoints: result.checkpoints, rngState: driver.rngState }).toMatchInlineSnapshot(`
    {
      "checkpoints": [
        {
          "nextSeed": "ffffffffffbc2ee30043d11c00000000",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "ffffffffffbc2ee30043d11c00000000",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "eaf086353e813a8603e71193023882e0",
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
            "xp": 52,
          },
          "time": 15000,
          "type": "progress",
        },
        {
          "nextSeed": "6ad191418169b6e6a1cca5fb2919ecfe",
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
            "xp": 36,
          },
          "time": 26250,
          "type": "progress",
        },
        {
          "levelUp": {
            "from": 1,
            "to": 2,
          },
          "nextSeed": "826452a79a66b918903d2d6927f88e4e",
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
          ],
          "rewards": {
            "xp": 46,
          },
          "time": 41250,
          "type": "progress",
        },
        {
          "nextSeed": "5b525f8d259b9a6668e715a4b15d38ae",
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
            "xp": 36,
          },
          "time": 53750,
          "type": "progress",
        },
        {
          "nextSeed": "5b525f8d259b9a6668e715a4b15d38ae",
          "rewardSlots": [],
          "rewards": {
            "xp": 195,
          },
          "time": 53750,
          "type": "completed",
        },
        {
          "nextSeed": "5b525f8d259b9a6668e715a4b15d38ae",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "5b525f8d259b9a6668e715a4b15d38ae",
          "time": 0,
          "type": "started",
        },
        {
          "nextSeed": "1f8b5a200542fd85ea049de64ccc36eb",
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
            "xp": 52,
          },
          "time": 16250,
          "type": "progress",
        },
        {
          "nextSeed": "1c9062e9a05197d7831e7b8596b99718",
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
            "xp": 36,
          },
          "time": 27500,
          "type": "progress",
        },
        {
          "levelUp": {
            "from": 1,
            "to": 2,
          },
          "nextSeed": "06bf46f013f04e4dc6f2bcb01046d682",
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
          ],
          "rewards": {
            "xp": 46,
          },
          "time": 43750,
          "type": "progress",
        },
        {
          "nextSeed": "335c10958e8269acf3160b165678e7fa",
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
            "xp": 36,
          },
          "time": 55000,
          "type": "progress",
        },
        {
          "nextSeed": "335c10958e8269acf3160b165678e7fa",
          "rewardSlots": [],
          "rewards": {
            "xp": 195,
          },
          "time": 55000,
          "type": "completed",
        },
        {
          "nextSeed": "335c10958e8269acf3160b165678e7fa",
          "rewardSlots": [],
          "rewards": {
            "xp": 0,
          },
          "seed": "335c10958e8269acf3160b165678e7fa",
          "time": 0,
          "type": "started",
        },
      ],
      "rngState": "bcab53dc82325d3b557d35da5903f12b",
    }
  `);
});

const EQUIVALENCE_SEEDS = [17, 90_210, 8_675_309, 424_242_424, 3_047_525_658, 555_000_111];

/**
 * Every replay path must consume the stamped seed identically: the single-attempt runner and the
 * checkpoint-capturing driver are separate orchestrations of the same engine, so their streams for
 * one input must match checkpoint-for-checkpoint. Chunked-advance equivalence is pinned separately
 * beside the driver.
 */
test('it produces one identical checkpoint stream across the attempt and driver paths', async () => {
  for (const seed of EQUIVALENCE_SEEDS) {
    const source = {
      avatarID: 'avatar-equivalence',
      buildSnapshot: { level: 5, xp: 0 },
      contentVersion: '1',
      encounterNode: { difficulty: 3 },
      id: `activity-equivalence-${seed}`,
      seed: buildStateFromSeed(seed),
    };

    const attemptInput = buildSimulationInput(source);

    const attempt = await runAttempt(attemptInput.activity, attemptInput.avatar, {
      maxDurationMs: 120_000,
    });

    invariant(attempt.outcome !== 'exceeded-budget', `seed ${seed} must terminate in budget`);

    const driverInput = buildSimulationInput(source);
    const driver = createSimulationDriver(driverInput.activity, driverInput.avatar);

    const advanced = await driver.advanceToDuration(120_000, undefined, attempt.checkpoints.length);

    expect(advanced.checkpoints).toStrictEqual(attempt.checkpoints);
  }
}, 20_000);
