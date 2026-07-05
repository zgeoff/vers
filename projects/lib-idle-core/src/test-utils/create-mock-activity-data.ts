import { createId } from '@paralleldrive/cuid2';
import type { ActivityData } from '../types';
import { ActivityFailureAction, ActivityType } from '../types';
import { createMockEnemyData } from './create-mock-enemy-data';

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
