import { sceneColors } from '@vers/design-system';
import type { BiomeField, Viewport } from '@vers/worldmap-core';
import { BIOME_ROSTER, CHUNK_SIZE, buildBiomeField, toHexPosition } from '@vers/worldmap-core';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  LinearFilter,
  RGBAFormat,
  UnsignedByteType,
} from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import invariant from 'tiny-invariant';
import { buildChunkKey } from '../chunk-stream/build-chunk-key';
import { useChunkStream } from '../chunk-stream/use-chunk-stream';
import { NODE_POSITION_SCALING_FACTOR } from '../consts';
import { scatterBuildStats } from '../scatter-build-stats';
import { useFogViewport } from '../state/use-fog-viewport';
import { useUserSeed } from '../state/use-user-seed';
import { sceneTSL } from './scene-tsl';

const BIOME_TEXELS_PER_CELL = 4;
const BIOME_CHUNK_CACHE_CAPACITY = 256;
const BIOME_GROUND_ELEVATION = -0.05;

export function BiomeGround() {
  const userSeed = useUserSeed();
  const viewport = useFogViewport();

  const entries = useChunkStream<BiomeChunkEntry>({
    build: buildBiomeChunkEntry,
    cacheCapacity: BIOME_CHUNK_CACHE_CAPACITY,
    dispose: disposeBiomeChunkEntry,
    onBuildTick: (buildMs) => {
      scatterBuildStats.buildMs = buildMs;
    },
    userSeed,
    viewport,
  });

  return (
    <>
      {entries.map((entry) => (
        <mesh
          geometry={entry.geometry}
          key={buildChunkKey(entry.chunkX, entry.chunkY)}
          material={entry.material}
          position={[0, 0, BIOME_GROUND_ELEVATION]}
        />
      ))}
    </>
  );
}

interface BiomeChunkEntry {
  readonly chunkX: number;
  readonly chunkY: number;
  readonly geometry: BufferGeometry;
  readonly material: MeshBasicNodeMaterial;
  readonly texture: DataTexture;
}

function buildBiomeChunkEntry(userSeed: number, chunkX: number, chunkY: number): BiomeChunkEntry {
  const box: Viewport = {
    maxCX: chunkX * CHUNK_SIZE + CHUNK_SIZE - 1,
    maxCY: chunkY * CHUNK_SIZE + CHUNK_SIZE - 1,
    minCX: chunkX * CHUNK_SIZE,
    minCY: chunkY * CHUNK_SIZE,
  };

  const field = buildBiomeField(userSeed, box, { resolution: BIOME_TEXELS_PER_CELL });
  const texture = buildGroundTexture(field);

  const material = new MeshBasicNodeMaterial();

  material.colorNode = sceneTSL.toNode(sceneTSL.texture(texture));

  return {
    chunkX,
    chunkY,
    geometry: buildBiomeChunkGeometry(box),
    material,
    texture,
  };
}

function disposeBiomeChunkEntry(entry: Readonly<BiomeChunkEntry>): void {
  entry.geometry.dispose();
  entry.material.dispose();
  entry.texture.dispose();
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

function buildGroundTexture(field: Readonly<BiomeField>): DataTexture {
  const bytes = new Uint8Array(field.cols * field.rows * 4);

  updateGroundBytes(bytes, field);

  const map = new DataTexture(bytes, field.cols, field.rows, RGBAFormat, UnsignedByteType);

  map.magFilter = LinearFilter;
  map.minFilter = LinearFilter;
  map.needsUpdate = true;

  return map;
}

function updateGroundBytes(bytes: Uint8Array, field: Readonly<BiomeField>): void {
  const count = field.cols * field.rows;

  for (let index = 0; index < count; index++) {
    const base = getBaseTint(field.baseIDs[index] ?? 0);
    const neighbour = getBaseTint(field.neighbourBaseIDs[index] ?? 0);
    const mixT = 0.5 * (field.blendTs[index] ?? 0);
    // The base tint blends toward the border neighbour's tint by half `blendT`.
    let r = base.r + (neighbour.r - base.r) * mixT;
    let g = base.g + (neighbour.g - base.g) * mixT;
    let b = base.b + (neighbour.b - base.b) * mixT;

    if ((field.modifierIDs[index] ?? 0) !== 0) {
      // The modifier tint overlays at `MODIFIER_OVERLAY_ALPHA` where the modifier layer drew non-`none`.
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
}

function getBaseTint(id: number): Color {
  const tint = BASE_TINTS.get(id);

  invariant(tint, 'every biome id the field draws appears in the roster tint table');

  return tint;
}

function buildBiomeChunkGeometry(box: Readonly<Viewport>): BufferGeometry {
  const corners = [
    toHexPosition(box.minCX - 0.5, box.minCY - 0.5),
    toHexPosition(box.maxCX + 0.5, box.minCY - 0.5),
    toHexPosition(box.minCX - 0.5, box.maxCY + 0.5),
    toHexPosition(box.maxCX + 0.5, box.maxCY + 0.5),
  ];

  const positions = new Float32Array(12);

  for (const [index, [x, y]] of corners.entries()) {
    positions[index * 3] = x * NODE_POSITION_SCALING_FACTOR;
    positions[index * 3 + 1] = y * NODE_POSITION_SCALING_FACTOR;
    positions[index * 3 + 2] = 0;
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  geometry.computeBoundingSphere();

  return geometry;
}
