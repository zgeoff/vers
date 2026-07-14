import { expect, test } from 'bun:test';
import { createMockWorldMapEdge } from './create-mock-world-map-edge';

test('it creates a world map edge with default properties', () => {
  const edge = createMockWorldMapEdge();

  expect(edge).toContainAllKeys(['end', 'id', 'start']);
});

test('it creates a world map edge with custom properties', () => {
  const edge = createMockWorldMapEdge({
    end: [17.1, 0],
    id: 'edge1',
    start: [17, 0],
  });

  expect(edge).toStrictEqual({
    end: [17.1, 0],
    id: 'edge1',
    start: [17, 0],
  });
});
