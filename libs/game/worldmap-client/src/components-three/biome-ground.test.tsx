import { expect, test } from 'bun:test';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { Viewport } from '@vers/worldmap-core';
import { CHUNK_SIZE } from '@vers/worldmap-core';
import { DataTexture } from 'three';
import type { Mesh, Object3D } from 'three';
import invariant from 'tiny-invariant';
import { setViewport } from '../state/set-viewport';
import { setWorldRegion } from '../state/set-world-region';
import { buildChunkAlignedViewport } from '../utils/build-chunk-aligned-viewport';
import { BiomeGround } from './biome-ground';

test('it renders nothing until a seed and a viewport exist', async () => {
  const renderer = await ReactThreeTestRenderer.create(<BiomeGround />);

  expect(renderer.scene.children).toHaveLength(0);

  await renderer.unmount();
});

test('it builds a texture sized to the inflated viewport', async () => {
  setWorldRegion('avatar-a', 42, { edges: {}, nodes: {} }, null, new Set(), []);
  setViewport({ maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 });

  const renderer = await ReactThreeTestRenderer.create(<BiomeGround />);

  expect(renderer.scene.children).toHaveLength(1);

  const plane = renderer.scene.children[0]!.instance;

  invariant(isMesh(plane), 'the sole child is the biome ground plane');

  // one parallelogram quad — two triangles over four vertices — carries the whole field
  expect(plane.geometry.getAttribute('position').count).toBe(4);
  expect(plane.geometry.index?.count).toBe(6);

  const texture = getGroundTexture(plane);
  const aligned = buildChunkAlignedViewport({ maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 });

  expect(texture.image.width).toBe(buildExpectedCols(aligned));
  expect(texture.image.height).toBe(buildExpectedRows(aligned));

  await renderer.unmount();
});

test('it rewrites the texture bytes in place on a same-size pan', async () => {
  setWorldRegion('avatar-a', 42, { edges: {}, nodes: {} }, null, new Set(), []);
  setViewport({ maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 });

  const renderer = await ReactThreeTestRenderer.create(<BiomeGround />);

  const plane = renderer.scene.children[0]!.instance;

  invariant(isMesh(plane), 'the sole child is the biome ground plane');

  const previousTexture = getGroundTexture(plane);
  const previousData = previousTexture.image.data;

  invariant(previousData, 'the ground texture carries a byte buffer');

  const previousBytes = Uint8Array.from(previousData);

  // translate by whole chunks so the aligned viewport moves without changing its span, keeping the
  // byte buffers the same length for a content comparison
  const shift = CHUNK_SIZE * 4;

  await ReactThreeTestRenderer.act(() => {
    setViewport({ maxCX: 2 + shift, maxCY: 2 + shift, minCX: -2 + shift, minCY: -2 + shift });

    return Promise.resolve();
  });

  const nextTexture = getGroundTexture(plane);
  const nextData = nextTexture.image.data;

  invariant(nextData, 'the panned ground texture carries a byte buffer');

  expect(nextTexture).toBe(previousTexture);

  const nextBytes = Uint8Array.from(nextData);

  expect(nextBytes).toHaveLength(previousBytes.length);
  expect(nextBytes).not.toEqual(previousBytes);

  await renderer.unmount();
});

test('it keeps one mesh and one material across pans, rebuilding the texture to the new size', async () => {
  setWorldRegion('avatar-a', 42, { edges: {}, nodes: {} }, null, new Set(), []);
  setViewport({ maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 });

  const renderer = await ReactThreeTestRenderer.create(<BiomeGround />);

  const plane = renderer.scene.children[0]!.instance;

  invariant(isMesh(plane), 'the sole child is the biome ground plane');

  const material = plane.material;
  const previousTexture = getGroundTexture(plane);
  const nextViewport: Viewport = { maxCX: 50, maxCY: 50, minCX: -50, minCY: -50 };

  await ReactThreeTestRenderer.act(() => {
    setViewport(nextViewport);

    return Promise.resolve();
  });

  expect(renderer.scene.children[0]!.instance).toBe(plane);
  expect(plane.material).toBe(material);

  const nextTexture = getGroundTexture(plane);
  const nextAligned = buildChunkAlignedViewport(nextViewport);

  expect(nextTexture.image.width).toBe(buildExpectedCols(nextAligned));
  expect(nextTexture.image.height).toBe(buildExpectedRows(nextAligned));
  expect(nextTexture).not.toBe(previousTexture);

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
 * Structural view of the mesh material's TSL color node, narrowing only the mutable texture value
 * slot `BiomeGround` itself reads and writes — the same untyped-node boundary its own facade type
 * exists to cross, so the test reads the identical `DataTexture` the material actually samples.
 */
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

/**
 * Mirrors BiomeGround's own private `BIOME_TEXELS_PER_CELL` and `BIOME_VIEWPORT_MARGIN_CELLS`. The
 * dimension assertions above apply this inflation on top of `buildChunkAlignedViewport` — the same
 * chunk-rounding `useFogViewport` applies before BiomeGround ever sees a viewport — so the expected
 * texel counts match what the component actually builds from, not the raw store viewport.
 */
const TEXELS_PER_CELL = 4;
const VIEWPORT_MARGIN_CELLS = 2;

function buildExpectedCols(viewport: Readonly<Viewport>): number {
  return (viewport.maxCX - viewport.minCX + 1 + 2 * VIEWPORT_MARGIN_CELLS) * TEXELS_PER_CELL;
}

function buildExpectedRows(viewport: Readonly<Viewport>): number {
  return (viewport.maxCY - viewport.minCY + 1 + 2 * VIEWPORT_MARGIN_CELLS) * TEXELS_PER_CELL;
}
