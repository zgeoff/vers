import { createId } from '@paralleldrive/cuid2';
import type { ActivityData } from '../types';
import { ActivityFailureAction, ActivityType } from '../types';
import { createMockEnemyData } from './create-mock-enemy-data';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function createMockActivityData(overrides: Partial<ActivityData> = {}): ActivityData {
  const activity: ActivityData = {
    enemies: [createMockEnemyData()],
    failureAction: ActivityFailureAction.Retry,
    id: createId(),
    name: 'Aether Node',
    seed: 1,
    type: ActivityType.AetherNode,
    ...overrides,
  };

  return activity;
}
