import { faker } from '@faker-js/faker';
import type { LatticeEdge } from '@vers/worldmap-core';

export function createMockWorldMapEdge(overrides: Partial<LatticeEdge> = {}): LatticeEdge {
  return {
    end: [faker.number.int({ max: 100, min: -100 }), faker.number.int({ max: 100, min: -100 })],
    id: faker.string.alphanumeric({ casing: 'lower', length: 24 }),
    start: [faker.number.int({ max: 100, min: -100 }), faker.number.int({ max: 100, min: -100 })],
    ...overrides,
  };
}
