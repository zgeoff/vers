import { expect, test } from 'bun:test';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { AetherNode as AetherNodeType } from '@vers/aether-core';
import { useHoveredNodeStore } from '../state/use-hovered-node-store';
import { useSelectedNodeStore } from '../state/use-selected-node-store';
import { AetherNode } from './aether-node';

const node: AetherNodeType = {
  connections: ['node2', null, null, null],
  difficulty: 1,
  id: 'node1',
  index: 0,
  position: [1, 2],
  seed: 12_345,
};

async function setupTest() {
  const renderer = await ReactThreeTestRenderer.create(<AetherNode node={node} />);

  return renderer;
}

test('it sets the hovered node when the mouse enters the node', async () => {
  const renderer = await setupTest();

  const mesh = renderer.scene.children[0]!;

  await renderer.fireEvent(mesh, 'pointerEnter');

  expect(useHoveredNodeStore.getState().node).toBe(node);
});

test('it unsets the hovered node when the mouse leaves the node', async () => {
  const renderer = await setupTest();

  const mesh = renderer.scene.children[0]!;

  await renderer.fireEvent(mesh, 'pointerEnter');
  await renderer.fireEvent(mesh, 'pointerLeave');

  expect(useHoveredNodeStore.getState().node).toBeNull();
});

test('it sets the selected node when the node is clicked and connected to the current selection', async () => {
  const renderer = await setupTest();

  const mesh = renderer.scene.children[0]!;

  await renderer.fireEvent(mesh, 'pointerDown', {
    object: mesh.instance,
  });

  expect(useSelectedNodeStore.getState().node).toBe(node);
  expect(useSelectedNodeStore.getState().object3D).toBe(mesh.instance);
});
