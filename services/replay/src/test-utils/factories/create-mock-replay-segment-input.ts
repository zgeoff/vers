import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { ReplaySegmentInput } from '@vers/contract-replay';
import { buildStateFromSeed } from '@vers/game-utils';

/**
 * A plain, unpersisted `replaySegment` request with faker-generated defaults, shaped like the
 * simplest world-map encounter the engine runs: one enemy, an unarmed avatar wielding no weapon.
 * `simVersion` defaults to the fixed value `test-setup.ts` bakes into `SIM_ENGINE_HASH`, so most
 * callers never need to override it.
 */
export function createMockReplaySegmentInput(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a Partial of the mutable request seed, whose nested activity/avatar have no readonly form; spread into the returned seed, never mutated
  overrides: Partial<ReplaySegmentInput> = {},
): ReplaySegmentInput {
  const input: ReplaySegmentInput = {
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
      id: createId(),
      name: 'World Map Encounter',
      seed: buildStateFromSeed(faker.number.int()),
      type: 'world_map_encounter',
    },
    avatar: {
      id: createId(),
      level: 1,
      life: 200,
      name: 'Test Avatar',
      paperdoll: { mainHand: null },
      xp: 0,
    },
    duration: 80_000,
    protocol: 1,
    simVersion: 'test-engine-hash',
    ...overrides,
  };

  return input;
}
