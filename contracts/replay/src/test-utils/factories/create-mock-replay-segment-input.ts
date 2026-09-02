import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import { buildStateFromSeed } from '@vers/game-utils';
import type { ReplaySegmentInput } from '../../replay-segment-input-schema';

export function createMockReplaySegmentInput(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a Partial of the mutable request seed, whose nested activity/avatar have no readonly form; spread into the returned seed, never mutated
  overrides: Partial<ReplaySegmentInput> = {},
): ReplaySegmentInput {
  const input: ReplaySegmentInput = {
    activity: {
      difficulty: 1,
      encounter: {
        waves: [
          [
            {
              level: 1,
              life: 30,
              name: 'Test Enemy',
              primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
              xp: 10,
            },
          ],
        ],
      },
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
    simVersion: faker.string.hexadecimal({ casing: 'lower', length: 64, prefix: '' }),
    ...overrides,
  };

  return input;
}
