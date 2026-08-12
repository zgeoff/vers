import { expect, test } from 'bun:test';
import { render, renderHook } from '@testing-library/react';
import { setWorldRegion, useSelectedNode } from '@vers/worldmap-client';
import type { WorldGraph } from '@vers/worldmap-client';
import { createMockWorldMapNode } from '@vers/worldmap-client/test-utils';
import { ExploreNodeFocus } from './explore-node-focus';

test('it selects the graph node matching the route param', () => {
  const node1 = createMockWorldMapNode({ id: 'node1' });
  const graph: WorldGraph = { edges: {}, nodes: { node1 } };

  setWorldRegion('region-a', graph, null, new Set());
  render(<ExploreNodeFocus nodeID="node1" />);

  const hook = renderHook(() => useSelectedNode());

  expect(hook.result.current.node).toStrictEqual(node1);
});

test('it renders nothing and leaves selection untouched for an unknown node id', () => {
  const node1 = createMockWorldMapNode({ id: 'node1' });
  const graph: WorldGraph = { edges: {}, nodes: { node1 } };

  setWorldRegion('region-b', graph, null, new Set());

  const rendered = render(<ExploreNodeFocus nodeID="missing-node" />);

  expect(rendered.container).toBeEmptyDOMElement();

  const hook = renderHook(() => useSelectedNode());

  expect(hook.result.current.node).toBeNull();
});
