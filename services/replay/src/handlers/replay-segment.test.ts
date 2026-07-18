import { expect, test } from 'bun:test';
import type { ActivityCheckpoint, ReplayContract } from '@vers/contract-replay';
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

/**
 * Recorded once from a passing run against the seed/avatar/enemy fixture above — the same
 * deterministic scenario `run-simulation.test.ts` (`@vers/idle-core`) commits to, since a pure
 * engine given identical input always reproduces it.
 */
const EXPECTED_CHECKPOINTS: Array<ActivityCheckpoint> = [
  {
    nextSeed: 'ffffffff4a5a72e5b5a58d1a00000000',
    rewards: { xp: 0 },
    rewardSlots: [],
    seed: 'ffffffff4a5a72e5b5a58d1a00000000',
    time: 0,
    type: 'started',
  },
  {
    nextSeed: '5468a77edf984ec079995dfd698938b2',
    rewards: { xp: 60 },
    rewardSlots: [
      { context: { nodeTier: 1 }, ordinal: 0 },
      { context: { nodeTier: 1 }, ordinal: 1 },
      { context: { nodeTier: 1 }, ordinal: 2 },
      { context: { nodeTier: 1 }, ordinal: 3 },
      { context: { nodeTier: 1 }, ordinal: 4 },
      { context: { nodeTier: 1 }, ordinal: 5 },
    ],
    time: 21_250,
    type: 'progress',
  },
  {
    levelUp: { from: 1, to: 2 },
    nextSeed: '86c008c1cb5d97968d4554750eefc5d4',
    rewards: { xp: 60 },
    rewardSlots: [
      { context: { nodeTier: 1 }, ordinal: 0 },
      { context: { nodeTier: 1 }, ordinal: 1 },
      { context: { nodeTier: 1 }, ordinal: 2 },
      { context: { nodeTier: 1 }, ordinal: 3 },
      { context: { nodeTier: 1 }, ordinal: 4 },
      { context: { nodeTier: 1 }, ordinal: 5 },
    ],
    time: 38_750,
    type: 'progress',
  },
  {
    nextSeed: 'f8e88eca342f7fe8bd8ab666f4b8bb62',
    rewards: { xp: 30 },
    rewardSlots: [
      { context: { nodeTier: 1 }, ordinal: 0 },
      { context: { nodeTier: 1 }, ordinal: 1 },
      { context: { nodeTier: 1 }, ordinal: 2 },
    ],
    time: 48_750,
    type: 'progress',
  },
  {
    nextSeed: '664be6d955fc249bfe89a1dbcdfd99cc',
    rewards: { xp: 40 },
    rewardSlots: [
      { context: { nodeTier: 1 }, ordinal: 0 },
      { context: { nodeTier: 1 }, ordinal: 1 },
      { context: { nodeTier: 1 }, ordinal: 2 },
      { context: { nodeTier: 1 }, ordinal: 3 },
    ],
    time: 61_250,
    type: 'progress',
  },
  {
    nextSeed: '664be6d955fc249bfe89a1dbcdfd99cc',
    rewards: { xp: 215 },
    rewardSlots: [],
    time: 61_250,
    type: 'completed',
  },
  {
    nextSeed: '664be6d955fc249bfe89a1dbcdfd99cc',
    rewards: { xp: 0 },
    rewardSlots: [],
    seed: '664be6d955fc249bfe89a1dbcdfd99cc',
    time: 0,
    type: 'started',
  },
];

async function setupTest() {
  const service = await createReplayService();
  const viewer = await createAnonymousViewer({ audience: 'service-replay' });

  const client = buildRPCTestClient<ReplayContract>(service.app, { token: viewer.token });

  return { client };
}

test('it reproduces the committed fixture for a fully-specified deterministic segment', async () => {
  const ctx = await setupTest();
  const result = await ctx.client.replaySegment(DETERMINISTIC_INPUT);

  expect(result).toStrictEqual({ checkpoints: EXPECTED_CHECKPOINTS, elapsed: 80_000 });
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
