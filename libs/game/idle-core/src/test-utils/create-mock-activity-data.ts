import { createId } from '@paralleldrive/cuid2';
import type { ActivityData } from '../types';
import { ActivityFailureAction, ActivityType } from '../types';
import { createMockEnemyData } from './create-mock-enemy-data';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a Partial of the mutable activity seed, whose nested enemies array has no readonly form; spread into the returned seed, never mutated
export function createMockActivityData(overrides: Partial<ActivityData> = {}): ActivityData {
  const activity: ActivityData = {
    enemies: [createMockEnemyData()],
    failureAction: ActivityFailureAction.Retry,
    id: createId(),
    name: 'World Node',
    seed: 1,
    type: ActivityType.WorldNode,
    ...overrides,
  };

  return activity;
}
