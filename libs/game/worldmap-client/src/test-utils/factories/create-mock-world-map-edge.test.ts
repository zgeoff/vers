import { expect, test } from 'bun:test';
import { createMockWorldMapEdge } from './create-mock-world-map-edge';

test('it creates a world map edge with default properties', () => {
  const edge = createMockWorldMapEdge();

  expect(edge).toContainAllKeys(['endPosition', 'id', 'startPosition']);
});

test('it creates a world map edge with custom properties', () => {
  const edge = createMockWorldMapEdge({
    endPosition: [17.1, 0],
    id: 'edge1',
    startPosition: [17, 0],
  });

  expect(edge).toStrictEqual({
    endPosition: [17.1, 0],
    id: 'edge1',
    startPosition: [17, 0],
  });
});
