import { faker } from '@faker-js/faker';
import type { WorldMapNode } from '@vers/worldmap-core';
import { toNodeID } from '@vers/worldmap-core';

export function createMockWorldMapNode(overrides: Partial<WorldMapNode> = {}): WorldMapNode {
  const cx = faker.number.int({ max: 100, min: -100 });
  const cy = faker.number.int({ max: 100, min: -100 });

  return {
    coord: [cx, cy],
    difficulty: faker.number.int({ max: 10, min: 0 }),
    id: toNodeID(cx, cy),
    position: [cx, cy],
    ...overrides,
  };
}
