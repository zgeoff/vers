import { expect, test } from 'bun:test';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { LineSegments, Mesh, Object3D } from 'three';
import invariant from 'tiny-invariant';
import { setCompletedNodeProjections } from '../state/set-completed-node-projections';
import { setViewport } from '../state/set-viewport';
import { FogOfWar } from './fog-of-war';

test('it renders nothing until reveal sources and a viewport exist', async () => {
  const renderer = await ReactThreeTestRenderer.create(<FogOfWar />);

  expect(renderer.scene.children).toHaveLength(0);

  await renderer.unmount();
});

test('it covers the falloff-inflated viewport with one transparent fog plane', async () => {
  setViewport({ maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 });
  setCompletedNodeProjections(new Set(), [{ coord: [0, 0], radius: 1 }]);

  const renderer = await ReactThreeTestRenderer.create(<FogOfWar />);

  const plane = renderer.scene.children[0]!.instance;

  invariant(isMesh(plane), 'the first child is the fog plane');

  expect(plane.material).toMatchObject({ depthWrite: false, transparent: true });

  // one parallelogram quad — two triangles over four vertices — carries the whole gradient
  expect(plane.geometry.getAttribute('position').count).toBe(4);
  expect(plane.geometry.index?.count).toBe(6);

  await renderer.unmount();
});

test('it traces the frontier between revealed and unrevealed cells', async () => {
  setViewport({ maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 });
  setCompletedNodeProjections(new Set(), [{ coord: [0, 0], radius: 1 }]);

  const renderer = await ReactThreeTestRenderer.create(<FogOfWar />);

  const line = renderer.scene.children[1]!.instance;

  invariant(isLineSegments(line), 'the second child is the frontier line');

  // the 7-cell disc's boundary is 18 hex sides, two vertices each
  expect(line.geometry.getAttribute('position').count).toBe(36);

  await renderer.unmount();
});

test('it keeps the frontier off cells whose neighbours are revealed beyond the viewport edge', async () => {
  setViewport({ maxCX: 0, maxCY: 0, minCX: 0, minCY: 0 });
  setCompletedNodeProjections(new Set(), [{ coord: [0, 0], radius: 1 }]);

  const renderer = await ReactThreeTestRenderer.create(<FogOfWar />);

  const line = renderer.scene.children[1]!.instance;

  invariant(isLineSegments(line), 'the second child is the frontier line');

  expect(line.geometry.getAttribute('position').count).toBe(0);

  await renderer.unmount();
});

/**
 * Duck-typed stand-in for `instanceof Mesh`: the test renderer constructs objects from a different
 * copy of three than this file imports, so an `instanceof` check never matches.
 */
function isMesh(object: Object3D): object is Mesh {
  return 'isMesh' in object && object.isMesh === true;
}

/**
 * Duck-typed stand-in for `instanceof LineSegments`, for the same cross-copy reason.
 */
function isLineSegments(object: Object3D): object is LineSegments {
  return 'isLineSegments' in object && object.isLineSegments === true;
}
