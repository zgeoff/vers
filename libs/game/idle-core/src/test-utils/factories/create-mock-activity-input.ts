import { createId } from '@paralleldrive/cuid2';
import { buildStateFromSeed } from '@vers/game-utils';
import type { ActivityInput } from '../../types';
import { ActivityFailureAction, ActivityType } from '../../types';
import { createMockEnemyData } from './create-mock-enemy-data';

export function createMockActivityInput(
  overrides: Readonly<Partial<ActivityInput>> = {},
): ActivityInput {
  const activity: ActivityInput = {
    difficulty: 1,
    encounter: { waves: [[createMockEnemyData()]] },
    failureAction: ActivityFailureAction.Retry,
    id: createId(),
    name: 'World Map Encounter',
    seed: buildStateFromSeed(1),
    type: ActivityType.WorldMapEncounter,
    ...overrides,
  };

  return activity;
}
