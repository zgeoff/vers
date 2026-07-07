import { renderHook } from '@testing-library/react';
import type { AetherGraph } from '@vers/aether-core';
import { expect, test } from 'vitest';
import { setAetherGraph } from './set-aether-graph';
import { useAetherGraph } from './use-aether-graph';

test('it returns the current aether graph state', () => {
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

  const result = renderHook(() => useAetherGraph()).result;

  expect(result.current).toStrictEqual(graph);
});
