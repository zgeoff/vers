import { faker } from '@faker-js/faker';
import type { ActivitySnapshot } from '@vers/idle-core';

export function createMockActivitySnapshot(
  overrides: Readonly<Partial<ActivitySnapshot>> = {},
): ActivitySnapshot {
  return {
    currentWave: null,
    elapsed: 0,
    enemiesRemaining: 0,
    id: faker.string.alphanumeric({ casing: 'lower', length: 24 }),
    levelUp: null,
    name: 'World Map Encounter',
    rewards: { xp: 0 },
    waves: [],
    wavesRemaining: 0,
    ...overrides,
  };
}
