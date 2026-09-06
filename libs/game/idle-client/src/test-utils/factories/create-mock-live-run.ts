import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { LiveRun } from '../../worker/live-run-schema';

export function createMockLiveRun(overrides: Readonly<Partial<LiveRun>> = {}): LiveRun {
  return {
    avatarID: `avatar_${createId()}`,
    id: `activity_${createId()}`,
    scopeID: `${faker.number.int({ max: 100, min: -100 })}_${faker.number.int({ max: 100, min: -100 })}`,
    scopeType: 'world_map_node',
    ...overrides,
  };
}
