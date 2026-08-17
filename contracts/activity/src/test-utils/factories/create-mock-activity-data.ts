import { faker } from '@faker-js/faker';
import type { ActivityData } from '../../activity-data-schema';

export function createMockActivityData(overrides: Partial<ActivityData> = {}): ActivityData {
  const startedAt = faker.date.recent();

  return {
    appendedAt: null,
    appendedHead: 0,
    avatarID: faker.string.alphanumeric({ casing: 'lower', length: 24 }),
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: '2',
    createdAt: startedAt,
    encounterNode: { difficulty: faker.number.int({ max: 10, min: 1 }) },
    id: faker.string.alphanumeric({ casing: 'lower', length: 24 }),
    keyVersion: 1,
    lastHash: faker.string.hexadecimal({ casing: 'lower', length: 64, prefix: '' }),
    playedAt: null,
    predecessorActivityID: null,
    scopeID: '0_0',
    scopeType: 'world_map_node',
    seed: faker.string.hexadecimal({ casing: 'lower', length: 32, prefix: '' }),
    secretRef: 'worldmap',
    secretVersion: 1,
    simVersion: '0.0.0-dev',
    startChainIndex: 0,
    startHash: faker.string.hexadecimal({ casing: 'lower', length: 64, prefix: '' }),
    startKey: null,
    startedAt,
    status: 'active',
    stoppedAt: null,
    updatedAt: startedAt,
    verifiedAt: null,
    verifiedHead: 0,
    ...overrides,
  };
}
