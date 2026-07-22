import { expect, test } from 'bun:test';
import type { ReplayContract } from '@vers/contract-replay';
import { createMockReplaySegmentInput } from '@vers/contract-replay/test-utils';
import { buildStateFromSeed } from '@vers/game-utils';
import { createAnonymousViewer } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createReplayService } from '../create-replay-service';

const DETERMINISTIC_INPUT = createMockReplaySegmentInput({
  simVersion: 'test-engine-hash',
  activity: {
    difficulty: 1,
    encounter: {
      waves: [
        Array.from({ length: 6 }, () => ({
          level: 1,
          life: 30,
          name: 'Test Enemy',
          primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
          xp: 10,
        })),
        Array.from({ length: 6 }, () => ({
          level: 1,
          life: 30,
          name: 'Test Enemy',
          primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
          xp: 10,
        })),
        Array.from({ length: 3 }, () => ({
          level: 1,
          life: 30,
          name: 'Test Enemy',
          primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
          xp: 10,
        })),
        Array.from({ length: 4 }, () => ({
          level: 1,
          life: 30,
          name: 'Test Enemy',
          primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
          xp: 10,
        })),
      ],
    },
    failureAction: 'retry',
    id: 'world_map_encounter_1',
    name: 'World Map Encounter',
    seed: buildStateFromSeed(3_047_525_658),
    type: 'world_map_encounter',
  },
  avatar: {
    id: 'avatar_1',
    level: 1,
    life: 200,
    name: 'Test Avatar',
    paperdoll: {
      mainHand: {
        id: 'weapon_1',
        maxDamage: 20,
        minDamage: 10,
        name: 'Bloodthirst Blade, Bastard Sword',
        speed: 0.8,
      },
    },
    xp: 0,
  },
  duration: 80_000,
});

async function setupTest() {
  const service = await createReplayService();
  const viewer = await createAnonymousViewer({ audience: 'service-replay' });

  const client = buildRPCTestClient<ReplayContract>(service.app, { token: viewer.token });

  return { client };
}

test('it reproduces the committed fixture for a fully-specified deterministic segment', async () => {
  const ctx = await setupTest();
  const result = await ctx.client.replaySegment(DETERMINISTIC_INPUT);

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

test('it reproduces the same result on a second call with identical input', async () => {
  const ctx = await setupTest();
  const first = await ctx.client.replaySegment(DETERMINISTIC_INPUT);
  const second = await ctx.client.replaySegment(DETERMINISTIC_INPUT);

  expect(second).toStrictEqual(first);
});

test('it rejects a simVersion that does not match this provider’s baked engine hash', async () => {
  const ctx = await setupTest();

  const input = createMockReplaySegmentInput({ simVersion: 'some-other-engine-hash' });

  expect(ctx.client.replaySegment(input)).rejects.toMatchObject({
    code: 'SIM_VERSION_MISMATCH',
    data: { providerSimVersion: 'test-engine-hash' },
  });
});
