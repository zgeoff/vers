import { expect, test } from 'bun:test';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { Mesh, Object3D } from 'three';
import invariant from 'tiny-invariant';
import { setViewport } from '../state/set-viewport';
import { setWorldRegion } from '../state/set-world-region';
import { BiomeGround } from './biome-ground';

test('it renders nothing until a seed and a viewport exist', async () => {
  const renderer = await ReactThreeTestRenderer.create(<BiomeGround />);

  expect(renderer.scene.children).toHaveLength(0);

  await renderer.unmount();
});

test('it covers the viewport with one biome ground plane', async () => {
  setWorldRegion('avatar-a', 42, { edges: {}, nodes: {} }, null, new Set(), []);
  setViewport({ maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 });

  const renderer = await ReactThreeTestRenderer.create(<BiomeGround />);

  expect(renderer.scene.children).toHaveLength(1);

  const plane = renderer.scene.children[0]!.instance;

  invariant(isMesh(plane), 'the sole child is the biome ground plane');

  // one parallelogram quad — two triangles over four vertices — carries the whole field
  expect(plane.geometry.getAttribute('position').count).toBe(4);
  expect(plane.geometry.index?.count).toBe(6);

  await renderer.unmount();
});

test('it keeps one mesh and one material across pans so the shader never recompiles', async () => {
  setWorldRegion('avatar-a', 42, { edges: {}, nodes: {} }, null, new Set(), []);
  setViewport({ maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 });

  const renderer = await ReactThreeTestRenderer.create(<BiomeGround />);

  const plane = renderer.scene.children[0]!.instance;

  invariant(isMesh(plane), 'the sole child is the biome ground plane');

  const material = plane.material;

  await ReactThreeTestRenderer.act(() => {
    setViewport({ maxCX: 40, maxCY: 3, minCX: 24, minCY: -1 });

    return Promise.resolve();
  });

  expect(renderer.scene.children[0]!.instance).toBe(plane);
  expect(plane.material).toBe(material);

  await renderer.unmount();
});

/**
 * Duck-typed stand-in for `instanceof Mesh`: the test renderer constructs objects from a different
 * copy of three than this file imports, so an `instanceof` check never matches.
 */
function isMesh(object: Object3D): object is Mesh {
  return 'isMesh' in object && object.isMesh === true;
}
