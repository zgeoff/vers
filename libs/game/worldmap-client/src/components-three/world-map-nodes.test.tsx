import { expect, test } from 'bun:test';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { WorldMapNode } from '@vers/worldmap-core';
import type { InstancedMesh, Object3D } from 'three';
import invariant from 'tiny-invariant';
import { useWorldmapStore } from '../state/use-worldmap-store';
import { createMockWorldMapNode } from '../test-utils/factories/create-mock-world-map-node';
import { WorldMapNodes } from './world-map-nodes';

async function setupTest(nodes: ReadonlyArray<WorldMapNode>) {
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

test('it moves the bounding sphere with the nodes when the list is replaced at the same count', async () => {
  const nearA = createMockWorldMapNode({ position: [0, 0] });
  const nearB = createMockWorldMapNode({ position: [1, 0] });

  const renderer = await setupTest([nearA, nearB]);

  const farA = createMockWorldMapNode({ position: [100, 100] });
  const farB = createMockWorldMapNode({ position: [101, 100] });

  await renderer.update(<WorldMapNodes nodes={[farA, farB]} />);

  const mesh = renderer.scene.children[0]!.instance;

  invariant(isInstancedMesh(mesh), 'the component renders an instanced mesh');
  invariant(mesh.boundingSphere, 'the layout effect computes the sphere before paint');

  expect(mesh.boundingSphere.center.x).toBeCloseTo(1005);
  expect(mesh.boundingSphere.center.y).toBeCloseTo(1000);
});

/**
 * Duck-typed stand-in for `instanceof InstancedMesh`: the test renderer constructs objects from a
 * different copy of three than this file imports, so an `instanceof` check never matches.
 */
function isInstancedMesh(object: Object3D): object is InstancedMesh {
  return 'isInstancedMesh' in object && object.isInstancedMesh === true;
}
