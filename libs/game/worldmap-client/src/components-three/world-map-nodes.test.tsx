import { expect, test } from 'bun:test';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { sceneColors } from '@vers/design-system';
import type { WorldMapNode } from '@vers/worldmap-core';
import type { InstancedMesh, Object3D } from 'three';
import { Color } from 'three';
import invariant from 'tiny-invariant';
import { setCompletedNodeProjections } from '../state/set-completed-node-projections';
import { useWorldmapStore } from '../state/use-worldmap-store';
import { createMockWorldMapNode } from '../test-utils/factories/create-mock-world-map-node';
import { WorldMapNodes } from './world-map-nodes';

const DIMMED_COLOR = new Color(sceneColors.nodeDimmed);
const BASE_COLOR = new Color(sceneColors.nodeBase);

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

test('it sets the selected node when a selectable node instance is clicked', async () => {
  const nodeA = createMockWorldMapNode({ id: 'nodeA' });
  const nodeB = createMockWorldMapNode({ id: 'nodeB' });

  setCompletedNodeProjections(new Set([nodeA.id]), []);

  const renderer = await setupTest([nodeA, nodeB]);

  const mesh = renderer.scene.children[0]!;

  await renderer.fireEvent(mesh, 'pointerDown', { instanceId: 0 });

  expect(useWorldmapStore.getState().selectedNode).toBe(nodeA);
});

test('it leaves the selection untouched when a non-selectable node instance is clicked', async () => {
  const nodeA = createMockWorldMapNode({ id: 'nodeA' });
  const nodeB = createMockWorldMapNode({ id: 'nodeB' });

  setCompletedNodeProjections(new Set([nodeA.id]), []);

  const renderer = await setupTest([nodeA, nodeB]);

  const mesh = renderer.scene.children[0]!;

  await renderer.fireEvent(mesh, 'pointerDown', { instanceId: 1 });

  expect(useWorldmapStore.getState().selectedNode).toBeNull();
});

test('it colors a non-selectable node instance dimmed and a selectable one at rest', async () => {
  const nodeA = createMockWorldMapNode({ id: 'nodeA' });
  const nodeB = createMockWorldMapNode({ id: 'nodeB' });

  setCompletedNodeProjections(new Set([nodeA.id]), []);

  const renderer = await setupTest([nodeA, nodeB]);

  const mesh = renderer.scene.children[0]!;

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- ReactThreeTestInstance's untyped `.instance` getter returns the generic Object3D; this scene's sole child is the component's own instancedMesh by construction
  const instance = mesh.instance as InstancedMesh;

  const colorA = new Color();
  const colorB = new Color();

  instance.getColorAt(0, colorA);
  instance.getColorAt(1, colorB);

  // instance colors round-trip through the mesh's float32 buffer, so the recovered values carry
  // precision loss the source colors never had — comparing the quantized 8-bit hex is exact
  expect(colorA.getHexString()).toBe(BASE_COLOR.getHexString());
  expect(colorB.getHexString()).toBe(DIMMED_COLOR.getHexString());
});

test('it moves the bounding sphere with the nodes when the list is replaced at the same count', async () => {
  const nearA = createMockWorldMapNode({ position: [0, 0] });
  const nearB = createMockWorldMapNode({ position: [1, 0] });

  const renderer = await setupTest([nearA, nearB]);

  const mesh = renderer.scene.children[0]!.instance;

  invariant(isInstancedMesh(mesh), 'the component renders an instanced mesh');

  // the renderer computes the sphere lazily on first cull; forcing it here reproduces that state,
  // so a stale sphere after the update reads as the old center rather than a missing sphere
  mesh.computeBoundingSphere();

  const farA = createMockWorldMapNode({ position: [100, 100] });
  const farB = createMockWorldMapNode({ position: [101, 100] });

  await renderer.update(<WorldMapNodes nodes={[farA, farB]} />);

  expect(renderer.scene.children[0]!.instance).toBe(mesh);

  invariant(mesh.boundingSphere, 'the sphere was computed before the update');

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
