import { faker } from '@faker-js/faker';
import type { ActivityData } from '@vers/contract-activity';

export function createMockActivityData(overrides: Partial<ActivityData> = {}): ActivityData {
  const startedAt = faker.date.recent();

  return {
    appendedAt: null,
    appendedHead: 0,
    avatarID: faker.string.alphanumeric({ casing: 'lower', length: 24 }),
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: '0.0.0-dev',
    createdAt: startedAt,
    id: faker.string.alphanumeric({ casing: 'lower', length: 24 }),
    keyVersion: 1,
    lastHash: faker.string.hexadecimal({ casing: 'lower', length: 64, prefix: '' }),
    scopeID: 'node_1',
    scopeType: 'world_map_node',
    seed: faker.string.hexadecimal({ casing: 'lower', length: 32, prefix: '' }),
    simVersion: '0.0.0-dev',
    startChainIndex: 0,
    startHash: faker.string.hexadecimal({ casing: 'lower', length: 64, prefix: '' }),
    startedAt,
    status: 'active',
    stoppedAt: null,
    updatedAt: startedAt,
    verifiedAt: null,
    verifiedHead: 0,
    ...overrides,
  };
}
