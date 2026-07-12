import { expect, test } from 'bun:test';
import { render, renderHook } from '@testing-library/react';
import { setSelectedNode, setWorldGraph, useSelectedNode } from '@vers/worldmap-client';
import type { WorldGraph, WorldMapNode } from '@vers/worldmap-core';
import { ExploreNodeFocus } from './explore-node-focus';

const node1: WorldMapNode = {
  connections: [null, null, null, null],
  difficulty: 1,
  id: 'node1',
  index: 0,
  position: [0, 0],
  seed: 0,
};

const graph: WorldGraph = {
  edges: {},
  nodes: { node1 },
};

test('it selects the graph node matching the route param', () => {
  setWorldGraph(graph);
  setSelectedNode(null);
  render(<ExploreNodeFocus nodeID="node1" />);

  const hook = renderHook(() => useSelectedNode());

  expect(hook.result.current.node).toStrictEqual(node1);
});

test('it renders nothing and leaves selection untouched for an unknown node id', () => {
  setWorldGraph(graph);
  setSelectedNode(null);

  const rendered = render(<ExploreNodeFocus nodeID="missing-node" />);

  expect(rendered.container).toBeEmptyDOMElement();

  const hook = renderHook(() => useSelectedNode());

  expect(hook.result.current.node).toBeNull();
});
