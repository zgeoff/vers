import { createId } from '@paralleldrive/cuid2';
import { buildStateFromSeed } from '@vers/game-utils';
import type { ActivityInput } from '../../types';
import { ActivityFailureAction, ActivityType } from '../../types';
import { createMockEnemyData } from './create-mock-enemy-data';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a Partial of the mutable activity seed, whose nested enemies array has no readonly form; spread into the returned seed, never mutated
export function createMockActivityInput(overrides: Partial<ActivityInput> = {}): ActivityInput {
  const activity: ActivityInput = {
    difficulty: 1,
    enemies: [createMockEnemyData()],
    failureAction: ActivityFailureAction.Retry,
    id: createId(),
    name: 'World Map Encounter',
    seed: buildStateFromSeed(1),
    type: ActivityType.WorldMapEncounter,
    ...overrides,
  };

  return activity;
}
