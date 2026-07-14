import { expect, test } from 'bun:test';
import { createMockWorldMapNode } from './create-mock-world-map-node';

test('it creates a world map node with default properties', () => {
  const node = createMockWorldMapNode();

  expect(node).toContainAllKeys(['connections', 'difficulty', 'id', 'index', 'position', 'seed']);
  expect(node.connections).toStrictEqual([null, null, null, null]);
});

test('it creates a world map node with custom properties', () => {
  const node = createMockWorldMapNode({
    connections: ['edge1', null, null, null],
    difficulty: 5,
    id: 'node1',
    index: 2,
    position: [3, 5],
    seed: 12_345,
  });

  expect(node).toStrictEqual({
    connections: ['edge1', null, null, null],
    difficulty: 5,
    id: 'node1',
    index: 2,
    position: [3, 5],
    seed: 12_345,
  });
});
