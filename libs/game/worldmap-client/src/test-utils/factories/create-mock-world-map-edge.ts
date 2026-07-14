import { faker } from '@faker-js/faker';
import type { WorldEdge } from '@vers/worldmap-core';

export function createMockWorldMapEdge(overrides: Partial<WorldEdge> = {}): WorldEdge {
  return {
    end: [faker.number.int({ max: 100, min: -100 }), faker.number.int({ max: 100, min: -100 })],
    id: faker.string.alphanumeric({ casing: 'lower', length: 24 }),
    start: [faker.number.int({ max: 100, min: -100 }), faker.number.int({ max: 100, min: -100 })],
    ...overrides,
  };
}
