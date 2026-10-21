import { expect, onTestFinished, test } from 'bun:test';
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

async function setupTest(nodes: ReadonlyArray<WorldMapNode>) {
  const renderer = await ReactThreeTestRenderer.create(<WorldMapNodes nodes={[...nodes]} />);

  onTestFinished(async () => {
    await renderer.unmount();
  });

  return {
    // duck-typed stand-in for `instanceof InstancedMesh`: the test renderer constructs objects
    // from a different copy of three than this file imports, so `instanceof` never matches
    isInstancedMesh: (object: Object3D): object is InstancedMesh =>
      'isInstancedMesh' in object && object.isInstancedMesh === true,
    renderer,
  };
}

test('it renders no mesh for an empty node list', async () => {
  const ctx = await setupTest([]);

  expect(ctx.renderer.scene.children).toHaveLength(0);
});

test('it mounts the mesh once the first non-empty node list arrives', async () => {
  const ctx = await setupTest([]);

  const node = createMockWorldMapNode({ id: 'nodeA' });

  await ctx.renderer.update(<WorldMapNodes nodes={[node]} />);

  expect(ctx.renderer.scene.children).toHaveLength(1);

  const mesh = ctx.renderer.scene.children[0]!.instance;

  invariant(ctx.isInstancedMesh(mesh), 'the component renders an instanced mesh');

  expect(mesh.count).toBe(1);
});

test('it sets the hovered node when the pointer enters a node instance', async () => {
  const nodeA = createMockWorldMapNode({ id: 'nodeA' });
  const nodeB = createMockWorldMapNode({ id: 'nodeB' });

  const ctx = await setupTest([nodeA, nodeB]);

  const mesh = ctx.renderer.scene.children[0]!;

  await ctx.renderer.fireEvent(mesh, 'pointerEnter', { instanceId: 1 });

  expect(useWorldmapStore.getState().hoveredNode).toBe(nodeB);
});

test('it unsets the hovered node when the pointer leaves the instanced mesh', async () => {
  const nodeA = createMockWorldMapNode({ id: 'nodeA' });
  const nodeB = createMockWorldMapNode({ id: 'nodeB' });

  const ctx = await setupTest([nodeA, nodeB]);

  const mesh = ctx.renderer.scene.children[0]!;

  await ctx.renderer.fireEvent(mesh, 'pointerEnter', { instanceId: 0 });
  await ctx.renderer.fireEvent(mesh, 'pointerLeave');

  expect(useWorldmapStore.getState().hoveredNode).toBeNull();
});

test('it sets the selected node when a selectable node instance is clicked', async () => {
  const nodeA = createMockWorldMapNode({ id: 'nodeA' });
  const nodeB = createMockWorldMapNode({ id: 'nodeB' });

  setCompletedNodeProjections(new Set([nodeA.id]), []);

  const ctx = await setupTest([nodeA, nodeB]);

  const mesh = ctx.renderer.scene.children[0]!;

  await ctx.renderer.fireEvent(mesh, 'pointerDown', { instanceId: 0 });

  expect(useWorldmapStore.getState().selectedNode).toBe(nodeA);
});

test('it leaves the selection untouched when a non-selectable node instance is clicked', async () => {
  const nodeA = createMockWorldMapNode({ id: 'nodeA' });
  const nodeB = createMockWorldMapNode({ id: 'nodeB' });

  setCompletedNodeProjections(new Set([nodeA.id]), []);

  const ctx = await setupTest([nodeA, nodeB]);

  const mesh = ctx.renderer.scene.children[0]!;

  await ctx.renderer.fireEvent(mesh, 'pointerDown', { instanceId: 1 });

  expect(useWorldmapStore.getState().selectedNode).toBeNull();
});

test('it colors a non-selectable node instance dimmed and a selectable one at rest', async () => {
  const nodeA = createMockWorldMapNode({ id: 'nodeA' });
  const nodeB = createMockWorldMapNode({ id: 'nodeB' });

  setCompletedNodeProjections(new Set([nodeA.id]), []);

  const ctx = await setupTest([nodeA, nodeB]);

  const mesh = ctx.renderer.scene.children[0]!;
  const instance = mesh.instance;

  invariant(ctx.isInstancedMesh(instance), 'the scene holds the nodes instanced mesh');

  const colorA = new Color();
  const colorB = new Color();

  instance.getColorAt(0, colorA);
  instance.getColorAt(1, colorB);

  // instance colors round-trip through the mesh's float32 buffer, so the recovered values carry
  // precision loss the source colors never had — comparing the quantized 8-bit hex is exact
  expect(colorA.getHexString()).toBe(new Color(sceneColors.nodeBase).getHexString());
  expect(colorB.getHexString()).toBe(new Color(sceneColors.nodeDimmed).getHexString());
});

test('it moves the bounding sphere with the nodes when the list is replaced at the same count', async () => {
  const nearA = createMockWorldMapNode({ position: [0, 0] });
  const nearB = createMockWorldMapNode({ position: [1, 0] });

  const ctx = await setupTest([nearA, nearB]);

  const mesh = ctx.renderer.scene.children[0]!.instance;

  invariant(ctx.isInstancedMesh(mesh), 'the component renders an instanced mesh');

  // the renderer computes the sphere lazily on first cull; forcing it here reproduces that state,
  // so a stale sphere after the update reads as the old center rather than a missing sphere
  mesh.computeBoundingSphere();

  const farA = createMockWorldMapNode({ position: [100, 100] });
  const farB = createMockWorldMapNode({ position: [101, 100] });

  await ctx.renderer.update(<WorldMapNodes nodes={[farA, farB]} />);

  expect(ctx.renderer.scene.children[0]!.instance).toBe(mesh);

  invariant(mesh.boundingSphere, 'the sphere was computed before the update');

  expect(mesh.boundingSphere.center.x).toBeCloseTo(1005);
  expect(mesh.boundingSphere.center.y).toBeCloseTo(1000);
});
