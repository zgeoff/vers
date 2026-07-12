import { expect, test } from 'bun:test';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { WorldMapNode } from '@vers/worldmap-core';
import { useHoveredNodeStore } from '../state/use-hovered-node-store';
import { useSelectedNodeStore } from '../state/use-selected-node-store';
import { WorldMapNodes } from './world-map-nodes';

const nodeA: WorldMapNode = {
  connections: ['nodeB', null, null, null],
  difficulty: 1,
  id: 'nodeA',
  index: 0,
  position: [1, 2],
  seed: 12_345,
};

const nodeB: WorldMapNode = {
  connections: [null, null, null, null],
  difficulty: 2,
  id: 'nodeB',
  index: 1,
  position: [3, 4],
  seed: 67_890,
};

async function setupTest() {
  const renderer = await ReactThreeTestRenderer.create(<WorldMapNodes nodes={[nodeA, nodeB]} />);

  return renderer;
}

test('it sets the hovered node when the pointer enters a node instance', async () => {
  const renderer = await setupTest();

  const mesh = renderer.scene.children[0]!;

  await renderer.fireEvent(mesh, 'pointerEnter', { instanceId: 1 });

  expect(useHoveredNodeStore.getState().node).toBe(nodeB);
});

test('it unsets the hovered node when the pointer leaves the instanced mesh', async () => {
  const renderer = await setupTest();

  const mesh = renderer.scene.children[0]!;

  await renderer.fireEvent(mesh, 'pointerEnter', { instanceId: 0 });
  await renderer.fireEvent(mesh, 'pointerLeave');

  expect(useHoveredNodeStore.getState().node).toBeNull();
});

test('it sets the selected node when a node instance is clicked', async () => {
  const renderer = await setupTest();

  const mesh = renderer.scene.children[0]!;

  await renderer.fireEvent(mesh, 'pointerDown', { instanceId: 0 });

  expect(useSelectedNodeStore.getState().node).toBe(nodeA);
});
