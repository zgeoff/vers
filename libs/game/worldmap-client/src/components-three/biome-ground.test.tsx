import { expect, onTestFinished, test } from 'bun:test';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CHUNK_SIZE } from '@vers/worldmap-core';
import { DataTexture } from 'three';
import type { Mesh, Object3D } from 'three';
import invariant from 'tiny-invariant';
import { scatterBuildStats } from '../scatter-build-stats';
import { setViewport } from '../state/set-viewport';
import { setWorldRegion } from '../state/set-world-region';
import { BiomeGround } from './biome-ground';

const ONE_CHUNK_VIEWPORT = { maxCX: CHUNK_SIZE - 1, maxCY: CHUNK_SIZE - 1, minCX: 0, minCY: 0 };

test('it renders nothing until a seed and a viewport exist', async () => {
  const renderer = await ReactThreeTestRenderer.create(<BiomeGround />);

  onTestFinished(() => renderer.unmount());

  expect(renderer.scene.children).toHaveLength(0);
});

test('it renders a chunk mesh once its tile finishes its progressive build', async () => {
  onTestFinished(() => {
    scatterBuildStats.buildMs = 0;
  });

  setWorldRegion('avatar-a', 42, { edges: {}, nodes: {} }, null, new Set(), []);
  setViewport(ONE_CHUNK_VIEWPORT);

  const renderer = await ReactThreeTestRenderer.create(<BiomeGround />);

  onTestFinished(() => renderer.unmount());

  await ReactThreeTestRenderer.waitFor(() => renderer.scene.children.length === 1);

  const plane = renderer.scene.children[0]!.instance;

  invariant(isMesh(plane), 'the rendered child is the chunk tile mesh');

  // one parallelogram quad — two triangles over four vertices — carries the chunk's tile
  expect(plane.geometry.getAttribute('position').count).toBe(4);
  expect(plane.geometry.index?.count).toBe(6);

  const texture = getGroundTexture(plane);
  const expectedTexels = CHUNK_SIZE * 4;

  expect(texture.image.width).toBe(expectedTexels);
  expect(texture.image.height).toBe(expectedTexels);
});

test('it drops a chunk mesh once a pan carries it out of view and streams in the entered chunk', async () => {
  onTestFinished(() => {
    scatterBuildStats.buildMs = 0;
  });

  setWorldRegion('avatar-a', 42, { edges: {}, nodes: {} }, null, new Set(), []);
  setViewport(ONE_CHUNK_VIEWPORT);

  const renderer = await ReactThreeTestRenderer.create(<BiomeGround />);

  onTestFinished(() => renderer.unmount());

  await ReactThreeTestRenderer.waitFor(() => renderer.scene.children.length === 1);

  const firstPlane = renderer.scene.children[0]!.instance;

  invariant(isMesh(firstPlane), 'the rendered child is the first chunk tile mesh');

  // several chunks away — outside the predictive-prefetch strip — so the departed chunk is never
  // still cached under the new viewport
  const farChunkOrigin = CHUNK_SIZE * 10;

  await ReactThreeTestRenderer.act(() => {
    setViewport({
      maxCX: farChunkOrigin + CHUNK_SIZE - 1,
      maxCY: farChunkOrigin + CHUNK_SIZE - 1,
      minCX: farChunkOrigin,
      minCY: farChunkOrigin,
    });

    return Promise.resolve();
  });

  await ReactThreeTestRenderer.waitFor(() => renderer.scene.children.length === 1);

  const secondPlane = renderer.scene.children[0]!.instance;

  invariant(isMesh(secondPlane), 'the rendered child is the entered chunk tile mesh');

  expect(secondPlane).not.toBe(firstPlane);
});

// duck-typed stand-in for `instanceof Mesh`: the test renderer constructs objects from a different
// copy of three than this file imports, so `instanceof` never matches
function isMesh(object: Object3D): object is Mesh {
  return 'isMesh' in object && object.isMesh === true;
}

interface ColorTextureNode {
  readonly value?: unknown;
}

function getGroundTexture(mesh: Mesh): DataTexture {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the material's real type is three's heavily generic node-material type; only this narrow, mutable-by-design slot is read
  const colorNode = (mesh.material as { colorNode?: ColorTextureNode }).colorNode;
  const value = colorNode?.value;

  invariant(value instanceof DataTexture, 'the ground plane material carries a live DataTexture');

  return value;
}
