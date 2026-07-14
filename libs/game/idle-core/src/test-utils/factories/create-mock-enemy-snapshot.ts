import { faker } from '@faker-js/faker';
import type { EnemySnapshot } from '../../types';
import { EntityStatus } from '../../types';

export function createMockEnemySnapshot(
  overrides: Readonly<Partial<EnemySnapshot>> = {},
): EnemySnapshot {
  return {
    behaviours: {},
    id: faker.string.alphanumeric({ casing: 'lower', length: 24 }),
    isAlive: true,
    level: 1,
    life: 30,
    maxLife: 30,
    name: 'Test Enemy',
    primaryAttack: {
      maxDamage: 3,
      minDamage: 1,
      speed: 0.5,
    },
    status: EntityStatus.Alive,
    ...overrides,
  };
}
