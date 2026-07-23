import { expect, test } from 'bun:test';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { LatticeNode } from '@vers/worldmap-core';
import { useWorldmapStore } from '../state/use-worldmap-store';
import { createMockWorldMapNode } from '../test-utils/factories/create-mock-world-map-node';
import { WorldMapNodes } from './world-map-nodes';

async function setupTest(nodes: ReadonlyArray<LatticeNode>) {
  const renderer = await ReactThreeTestRenderer.create(<WorldMapNodes nodes={[...nodes]} />);

  return renderer;
}

test('it sets the hovered node when the pointer enters a node instance', async () => {
  const nodeA = createMockWorldMapNode({ id: 'nodeA' });
  const nodeB = createMockWorldMapNode({ id: 'nodeB' });

  const renderer = await setupTest([nodeA, nodeB]);

  const mesh = renderer.scene.children[0]!;

  await renderer.fireEvent(mesh, 'pointerEnter', { instanceId: 1 });

  expect(useWorldmapStore.getState().hoveredNode).toBe(nodeB);
});

test('it unsets the hovered node when the pointer leaves the instanced mesh', async () => {
  const nodeA = createMockWorldMapNode({ id: 'nodeA' });
  const nodeB = createMockWorldMapNode({ id: 'nodeB' });

  const renderer = await setupTest([nodeA, nodeB]);

  const mesh = renderer.scene.children[0]!;

  await renderer.fireEvent(mesh, 'pointerEnter', { instanceId: 0 });
  await renderer.fireEvent(mesh, 'pointerLeave');

  expect(useWorldmapStore.getState().hoveredNode).toBeNull();
});

test('it sets the selected node when a node instance is clicked', async () => {
  const nodeA = createMockWorldMapNode({ id: 'nodeA' });
  const nodeB = createMockWorldMapNode({ id: 'nodeB' });

  const renderer = await setupTest([nodeA, nodeB]);

  const mesh = renderer.scene.children[0]!;

  await renderer.fireEvent(mesh, 'pointerDown', { instanceId: 0 });

  expect(useWorldmapStore.getState().selectedNode).toBe(nodeA);
});
