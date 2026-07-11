import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import type { WorldGraph } from '@vers/worldmap-core';
import { setWorldGraph } from './set-world-graph';
import { useWorldGraph } from './use-world-graph';

test('it returns the current world graph state', () => {
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

  const hook = renderHook(() => useWorldGraph());

  expect(hook.result.current).toStrictEqual(graph);
});
