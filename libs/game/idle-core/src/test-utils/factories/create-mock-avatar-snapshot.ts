import { faker } from '@faker-js/faker';
import type { AvatarSnapshot } from '../../types';
import { EntityStatus } from '../../types';

export function createMockAvatarSnapshot(
  overrides: Readonly<Partial<AvatarSnapshot>> = {},
): AvatarSnapshot {
  return {
    behaviours: {},
    id: faker.string.alphanumeric({ casing: 'lower', length: 24 }),
    isAlive: true,
    level: 1,
    life: 100,
    mainHandAttack: null,
    maxLife: 100,
    name: 'Test Avatar',
    status: EntityStatus.Alive,
    ...overrides,
  };
}
