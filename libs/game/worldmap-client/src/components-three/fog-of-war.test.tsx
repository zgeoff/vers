import { expect, test } from 'bun:test';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { Mesh, Object3D } from 'three';
import invariant from 'tiny-invariant';
import { setCompletedNodeProjections } from '../state/set-completed-node-projections';
import { setViewport } from '../state/set-viewport';
import { FogOfWar } from './fog-of-war';

test('it renders nothing until reveal sources and a viewport exist', async () => {
  const renderer = await ReactThreeTestRenderer.create(<FogOfWar />);

  expect(renderer.scene.children).toHaveLength(0);

  await renderer.unmount();
});

test('it covers the viewport with one transparent fog plane', async () => {
  setViewport({ maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 });
  setCompletedNodeProjections(new Set(), [{ coord: [0, 0], radius: 1 }]);

  const renderer = await ReactThreeTestRenderer.create(<FogOfWar />);

  expect(renderer.scene.children).toHaveLength(1);

  const plane = renderer.scene.children[0]!.instance;

  invariant(isMesh(plane), 'the sole child is the fog plane');

  expect(plane.material).toMatchObject({ depthWrite: false, transparent: true });

  // one parallelogram quad — two triangles over four vertices — carries the whole gradient
  expect(plane.geometry.getAttribute('position').count).toBe(4);
  expect(plane.geometry.index?.count).toBe(6);

  await renderer.unmount();
});

/**
 * Duck-typed stand-in for `instanceof Mesh`: the test renderer constructs objects from a different
 * copy of three than this file imports, so an `instanceof` check never matches.
 */
function isMesh(object: Object3D): object is Mesh {
  return 'isMesh' in object && object.isMesh === true;
}
