import { expect, test } from 'bun:test';
import type { ActivityCheckpoint, ReplayContract } from '@vers/contract-replay';
import { buildStateFromSeed } from '@vers/game-utils';
import { createAnonymousViewer } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createReplayService } from '../create-replay-service';
import { createMockReplaySegmentInput } from '../test-utils/factories/create-mock-replay-segment-input';

const DETERMINISTIC_INPUT = createMockReplaySegmentInput({
  activity: {
    difficulty: 1,
    enemies: [
      {
        level: 1,
        life: 30,
        name: 'Test Enemy',
        primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
        xp: 10,
      },
    ],
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
    nextSeed: '63298078c2177576c07e0321584c2a05',
    rewards: { xp: 0 },
    seed: '63298078c2177576c07e0321584c2a05',
    time: 0,
    type: 'started',
  },
  {
    nextSeed: '20c0dac3c8da96ee1a82332c38c2e8ae',
    rewards: { xp: 60 },
    time: 16_300,
    type: 'progress',
  },
  {
    levelUp: { from: 1, to: 2 },
    nextSeed: '651b7bac24e8282ac2345557ee733dc5',
    rewards: { xp: 60 },
    time: 33_800,
    type: 'progress',
  },
  {
    nextSeed: '183a8b662f0c22f40b637a9f83c410ca',
    rewards: { xp: 30 },
    time: 43_800,
    type: 'progress',
  },
  {
    nextSeed: '0d1c5f2ed8a45260129c426ab502cbb3',
    rewards: { xp: 40 },
    time: 56_300,
    type: 'progress',
  },
  {
    nextSeed: '0d1c5f2ed8a45260129c426ab502cbb3',
    rewards: { xp: 215 },
    time: 56_300,
    type: 'completed',
  },
  {
    nextSeed: '664be6d955fc249bfe89a1dbcdfd99cc',
    rewards: { xp: 0 },
    seed: '664be6d955fc249bfe89a1dbcdfd99cc',
    time: 0,
    type: 'started',
  },
  {
    nextSeed: 'dd5a3353a7f6c0c6afcb296684176982',
    rewards: { xp: 40 },
    time: 13_800,
    type: 'progress',
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
