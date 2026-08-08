import { expect, test } from 'bun:test';
import { createMockWorldMapNode } from './create-mock-world-map-node';

test('it creates a world map node with default properties', () => {
  const node = createMockWorldMapNode();

  expect(node).toContainAllKeys(['coord', 'difficulty', 'id', 'position']);
});

test('it creates a world map node with custom properties', () => {
  const node = createMockWorldMapNode({
    coord: [3, 5],
    difficulty: 5,
    id: 'node1',
    position: [3, 5],
  });

  expect(node).toStrictEqual({
    coord: [3, 5],
    difficulty: 5,
    id: 'node1',
    position: [3, 5],
  });
});
