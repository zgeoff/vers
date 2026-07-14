import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import type { WorldGraph } from '@vers/worldmap-core';
import { setWorldGraph } from './set-world-graph';
import { useWorldmapStore } from './use-worldmap-store';

test('it updates the world graph in the store', () => {
  const graph: WorldGraph = {
    edges: { edge1: { end: [0, 0], id: 'edge1', start: [0, 0] } },
    nodes: {
      node1: {
        connections: [null, null, null, null],
        difficulty: 1,
        id: 'node1',
        index: 0,
        position: [0, 0],
        seed: 0,
      },
    },
  };

  setWorldGraph(graph);

  const hook = renderHook(() => useWorldmapStore((state) => state.worldGraph));

  expect(hook.result.current).toStrictEqual(graph);
});
