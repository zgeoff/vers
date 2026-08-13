/**
 * SPIKE: chunk-keyed incremental world generation. Each generation chunk builds once — displaced
 * ground tile (geometry + tint texture + material) and scatter part arrays — and persists in a
 * world-anchored LRU cache, so a pan re-mounts cached chunks instantly and only the newly entered
 * border strip generates. Misses build progressively, a few per frame. Not production code.
 */
import type { Viewport } from '@vers/worldmap-core';
import { CHUNK_SIZE, buildBiomeField, getBiome, toHexPosition } from '@vers/worldmap-core';
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { InstancedMesh } from 'three';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  LinearFilter,
  RGBAFormat,
  UnsignedByteType,
} from 'three';
import { extend } from '@react-three/fiber';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import invariant from 'tiny-invariant';
import { sceneColors } from '@vers/design-system';
import { BIOME_ROSTER } from '@vers/worldmap-core';
import { NODE_POSITION_SCALING_FACTOR } from '../consts';
import { useFogViewport } from '../state/use-fog-viewport';
import { useIsScatterVisible } from '../state/use-is-scatter-visible';
import { useUserSeed } from '../state/use-user-seed';
import type { ScatterBuild } from './biome-scatter';
import { CONCAT_GLOW, CONCAT_PARTS, buildScatterForBox } from './biome-scatter';
import type { GroundHeightSampler } from './ground-relief';
import { makeGroundHeightSampler } from './ground-relief';
import { sceneTSL } from './scene-tsl';

const ScatterMaterial = extend(MeshStandardNodeMaterial);
const GlowMaterial = extend(MeshBasicNodeMaterial);

const TEXELS_PER_CELL = 4;
const GRID_VERTS_PER_CELL = 2;

/** chunks the scatter concat spans around the viewport center (ground tiles render everywhere) */
const SCATTER_CHUNK_RADIUS = 1;

/** chunk builds allowed per progressive tick */
const BUILDS_PER_TICK = 2;

/** cached chunks kept before evicting least-recently-used off-screen entries */
const CACHE_CAP = 280;

const GLOW_COLOR = new Color('#7dd3fc');

/** all emissives breathe together on scene time — a slow shared pulse, not per-instance blink */
const glowPulse = {
  opacityNode: sceneTSL.toNode(sceneTSL.time.mul(1.6).sin().mul(0.22).add(0.78)),
};

/** spike perf stats, read by the dev HUD */
export const scatterStats = { buildMs: 0, glow: 0, parts: 0 };

interface ChunkEntry {
  readonly chunkX: number;
  readonly chunkY: number;
  readonly geometry: BufferGeometry;
  readonly material: MeshStandardNodeMaterial;
  readonly scatter: ScatterBuild;
  readonly texture: DataTexture;
}

const cache = new Map<string, ChunkEntry>();

let cacheSeed: number | null = null;
let cachedSampler: GroundHeightSampler | null = null;

function getSampler(userSeed: number): GroundHeightSampler {
  if (cacheSeed !== userSeed || cachedSampler === null) {
    for (const entry of cache.values()) {
      removeEntry(entry);
    }

    cache.clear();
    cacheSeed = userSeed;
    cachedSampler = makeGroundHeightSampler(userSeed);
  }

  return cachedSampler;
}

function removeEntry(entry: ChunkEntry): void {
  entry.geometry.dispose();
  entry.material.dispose();
  entry.texture.dispose();
}

function buildChunkEntry(userSeed: number, chunkX: number, chunkY: number): ChunkEntry {
  const sampler = getSampler(userSeed);
  const box: Viewport = {
    maxCX: chunkX * CHUNK_SIZE + CHUNK_SIZE - 1,
    maxCY: chunkY * CHUNK_SIZE + CHUNK_SIZE - 1,
    minCX: chunkX * CHUNK_SIZE,
    minCY: chunkY * CHUNK_SIZE,
  };

  const field = buildBiomeField(userSeed, box, { resolution: TEXELS_PER_CELL });
  const texture = buildTileTexture(field);
  const material = new MeshStandardNodeMaterial({ roughness: 0.95 });

  // patchy world-anchored grime over the tint: two noise octaves darken the ground unevenly, so
  // flat color reads as worn surface instead of vector fill
  const ground = sceneTSL.positionWorld.xz;
  const grimeCoarse = sceneTSL.mx_noise_float(ground.mul(0.045));
  const grimeFine = sceneTSL.mx_noise_float(ground.mul(0.24));
  const grime = grimeCoarse.mul(0.12).add(grimeFine.mul(0.08)).add(0.86);

  material.colorNode = sceneTSL.shade(sceneTSL.texture(texture), grime);

  return {
    chunkX,
    chunkY,
    geometry: buildTileGeometry(userSeed, sampler, box),
    material,
    scatter: buildScatterForBox(userSeed, box, sampler),
    texture,
  };
}

/**
 * Resolves the chunk entries covering a viewport, building at most a few misses per animation
 * frame so a pan never stalls: cached chunks appear instantly, new border chunks fill in over the
 * following frames.
 */
function useChunkWorld(userSeed: number | null, viewport: Viewport | null): Array<ChunkEntry> {
  const [tick, setTick] = useState(0);
  const pending = useRef<Array<string>>([]);

  // computed per render — the progressive builder ticks renders as chunks land, and cache lookups
  // are cheap enough that memoizing (and going stale against the mutable cache) isn't worth it
  const entries: Array<ChunkEntry> = [];

  if (userSeed !== null && viewport !== null) {
    getSampler(userSeed);

    const minChunkX = Math.floor(viewport.minCX / CHUNK_SIZE);
    const maxChunkX = Math.floor(viewport.maxCX / CHUNK_SIZE);
    const minChunkY = Math.floor(viewport.minCY / CHUNK_SIZE);
    const maxChunkY = Math.floor(viewport.maxCY / CHUNK_SIZE);
    const misses: Array<string> = [];

    for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
        const key = `${chunkX}_${chunkY}`;
        const entry = cache.get(key);

        if (entry !== undefined) {
          // touch for LRU recency
          cache.delete(key);
          cache.set(key, entry);
          entries.push(entry);
        } else {
          misses.push(key);
        }
      }
    }

    pending.current = misses;
  }

  useEffect(() => {
    if (userSeed === null || pending.current.length === 0) {
      return;
    }

    let cancelled = false;

    const step = () => {
      if (cancelled || pending.current.length === 0) {
        return;
      }

      const started = performance.now();

      for (let i = 0; i < BUILDS_PER_TICK && pending.current.length > 0; i++) {
        const key = pending.current.shift();

        if (key === undefined || cache.has(key)) {
          continue;
        }

        const [chunkX, chunkY] = key.split('_').map(Number);

        invariant(chunkX !== undefined && chunkY !== undefined, 'chunk keys are x_y pairs');

        cache.set(key, buildChunkEntry(userSeed, chunkX, chunkY));
      }

      scatterStats.buildMs = performance.now() - started;

      while (cache.size > CACHE_CAP) {
        const oldest = cache.entries().next().value;

        if (oldest === undefined) {
          break;
        }

        cache.delete(oldest[0]);
        removeEntry(oldest[1]);
      }

      // re-render so freshly built chunks mount, then keep draining
      setTick((t) => t + 1);

      if (pending.current.length > 0) {
        requestAnimationFrame(step);
      }
    };

    const frame = requestAnimationFrame(step);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [userSeed, viewport, tick]);

  return entries;
}

export function ChunkGround() {
  const userSeed = useUserSeed();
  const viewport = useDeferredValue(useFogViewport());
  const entries = useChunkWorld(userSeed, viewport);

  return (
    <>
      {entries.map((entry) => (
        <mesh
          geometry={entry.geometry}
          key={`${entry.chunkX}_${entry.chunkY}`}
          material={entry.material}
          position={[0, 0, -0.05]}
        />
      ))}
    </>
  );
}

export function ChunkScatter() {
  const userSeed = useUserSeed();
  const viewport = useDeferredValue(useFogViewport());
  const isVisible = useIsScatterVisible();
  const entries = useChunkWorld(userSeed, viewport);
  const meshRef = useRef<InstancedMesh | null>(null);
  const glowRef = useRef<InstancedMesh | null>(null);

  // concat scatter from the chunks near the viewport center — cheap memcpy, no generation
  const windowed = useMemo(() => {
    if (viewport === null) {
      return [];
    }

    const centerChunkX = Math.floor((viewport.minCX + viewport.maxCX) / 2 / CHUNK_SIZE);
    const centerChunkY = Math.floor((viewport.minCY + viewport.maxCY) / 2 / CHUNK_SIZE);

    return entries.filter(
      (entry) =>
        Math.abs(entry.chunkX - centerChunkX) <= SCATTER_CHUNK_RADIUS &&
        Math.abs(entry.chunkY - centerChunkY) <= SCATTER_CHUNK_RADIUS,
    );
  }, [entries, viewport]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    const glow = glowRef.current;

    if (mesh === null || glow === null) {
      return;
    }

    let parts = 0;
    let glows = 0;
    const colorArray = mesh.instanceColor?.array;

    for (const entry of windowed) {
      const take = Math.min(entry.scatter.count, CONCAT_PARTS - parts);

      mesh.instanceMatrix.array.set(entry.scatter.matrices.subarray(0, take * 16), parts * 16);

      if (colorArray) {
        colorArray.set(entry.scatter.colors.subarray(0, take * 3), parts * 3);
      }

      parts += take;

      const takeGlow = Math.min(entry.scatter.glowCount, CONCAT_GLOW - glows);

      glow.instanceMatrix.array.set(
        entry.scatter.glowMatrices.subarray(0, takeGlow * 16),
        glows * 16,
      );

      glows += takeGlow;
    }

    mesh.count = parts;
    mesh.instanceMatrix.needsUpdate = true;

    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }

    mesh.computeBoundingSphere();

    glow.count = glows;
    glow.instanceMatrix.needsUpdate = true;

    glow.computeBoundingSphere();

    scatterStats.parts = parts;
    scatterStats.glow = glows;
  }, [windowed]);

  // instanceColor must exist before the first concat writes into it
  useLayoutEffect(() => {
    const mesh = meshRef.current;

    if (mesh && mesh.instanceColor === null) {
      mesh.setColorAt(0, GLOW_COLOR);
    }
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <>
      <directionalLight intensity={1.4} position={[30, -40, 80]} />
      <instancedMesh args={[undefined, undefined, CONCAT_PARTS]} frustumCulled={false} ref={meshRef}>
        <boxGeometry args={[1, 1, 1]} />
        <ScatterMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, CONCAT_GLOW]} frustumCulled={false} ref={glowRef}>
        <boxGeometry args={[1, 1, 1]} />
        <GlowMaterial color={GLOW_COLOR} transparent={true} {...glowPulse} />
      </instancedMesh>
    </>
  );
}

const BASE_TINT_HEXES: ReadonlyArray<string> = [
  sceneColors.biome1,
  sceneColors.biome2,
  sceneColors.biome3,
  sceneColors.biome4,
];

const BASE_TINTS: ReadonlyMap<number, Color> = new Map(
  BIOME_ROSTER.map((entry, index) => {
    const hex = BASE_TINT_HEXES[index];

    invariant(hex !== undefined, 'every base-biome roster entry carries a placeholder tint');

    return [entry.id, new Color(hex)];
  }),
);

const MODIFIER_TINT = new Color(sceneColors.modifierOverlay);
const MODIFIER_OVERLAY_ALPHA = 0.35;

function buildTileTexture(field: ReturnType<typeof buildBiomeField>): DataTexture {
  const bytes = new Uint8Array(field.cols * field.rows * 4);
  const count = field.cols * field.rows;

  for (let index = 0; index < count; index++) {
    const base = getBaseTint(field.baseIDs[index] ?? 0);
    const neighbour = getBaseTint(field.neighbourBaseIDs[index] ?? 0);
    const mixT = 0.5 * (field.blendTs[index] ?? 0);
    let r = base.r + (neighbour.r - base.r) * mixT;
    let g = base.g + (neighbour.g - base.g) * mixT;
    let b = base.b + (neighbour.b - base.b) * mixT;

    if ((field.modifierIDs[index] ?? 0) !== 0) {
      r += (MODIFIER_TINT.r - r) * MODIFIER_OVERLAY_ALPHA;
      g += (MODIFIER_TINT.g - g) * MODIFIER_OVERLAY_ALPHA;
      b += (MODIFIER_TINT.b - b) * MODIFIER_OVERLAY_ALPHA;
    }

    const offset = index * 4;

    bytes[offset] = Math.round(r * 255);
    bytes[offset + 1] = Math.round(g * 255);
    bytes[offset + 2] = Math.round(b * 255);
    bytes[offset + 3] = 255;
  }

  const map = new DataTexture(bytes, field.cols, field.rows, RGBAFormat, UnsignedByteType);

  map.magFilter = LinearFilter;
  map.minFilter = LinearFilter;
  map.needsUpdate = true;

  return map;
}

function getBaseTint(id: number): Color {
  const tint = BASE_TINTS.get(id);

  invariant(tint, 'every biome id the field draws appears in the roster tint table');

  return tint;
}

/**
 * Displaced tile grid spanning the chunk's inflated cell box; adjacent tiles share exact edge
 * coordinates and identical sampled heights, so seams close without stitching.
 */
function buildTileGeometry(
  userSeed: number,
  sampler: GroundHeightSampler,
  box: Readonly<Viewport>,
): BufferGeometry {
  const spanX = box.maxCX - box.minCX + 1;
  const spanY = box.maxCY - box.minCY + 1;
  const cols = spanX * GRID_VERTS_PER_CELL + 1;
  const rows = spanY * GRID_VERTS_PER_CELL + 1;
  const strideX = spanX / (cols - 1);
  const strideY = spanY / (rows - 1);
  const f = NODE_POSITION_SCALING_FACTOR;

  const positions = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);
  const biomes = new Map<string, number>();

  const getCellBiome = (cellX: number, cellY: number): number => {
    const key = `${cellX}_${cellY}`;
    let biome = biomes.get(key);

    if (biome === undefined) {
      biome = getBiome(userSeed, cellX, cellY).baseID;
      biomes.set(key, biome);
    }

    return biome;
  };

  for (let j = 0; j < rows; j++) {
    const cy = box.minCY - 0.5 + j * strideY;

    for (let i = 0; i < cols; i++) {
      const cx = box.minCX - 0.5 + i * strideX;
      const [x, y] = toHexPosition(cx, cy);
      const z = sampler(x, y, getCellBiome(Math.round(cx), Math.round(cy)));
      const index = j * cols + i;

      positions[index * 3] = x * f;
      positions[index * 3 + 1] = y * f;
      positions[index * 3 + 2] = z * f;
      uvs[index * 2] = i / (cols - 1);
      uvs[index * 2 + 1] = j / (rows - 1);
    }
  }

  const indices: Array<number> = [];

  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;

      indices.push(a, b, c, c, b, d);
    }
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}
