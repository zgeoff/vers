import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import type { AetherGraph } from '@vers/aether-core';
import { setAetherGraph } from './set-aether-graph';
import { useAetherGraphStore } from './use-aether-graph-store';

test('it updates the aether graph in the store', () => {
  const graph: AetherGraph = {
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

  setAetherGraph(graph);

  const hook = renderHook(() => useAetherGraphStore((state) => state));

  expect(hook.result.current).toStrictEqual(graph);
});
