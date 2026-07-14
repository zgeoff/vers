import { faker } from '@faker-js/faker';
import type { WorldMapNode } from '@vers/worldmap-core';

export function createMockWorldMapNode(overrides: Partial<WorldMapNode> = {}): WorldMapNode {
  return {
    connections: [null, null, null, null],
    difficulty: faker.number.int({ max: 10, min: 0 }),
    id: faker.string.alphanumeric({ casing: 'lower', length: 24 }),
    index: faker.number.int({ max: 100, min: 0 }),
    position: [
      faker.number.int({ max: 100, min: -100 }),
      faker.number.int({ max: 100, min: -100 }),
    ],
    seed: faker.number.int(),
    ...overrides,
  };
}
