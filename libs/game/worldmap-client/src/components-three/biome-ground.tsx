/**
 * SPIKE VARIANT: the biome tint ground, displaced by the shared terrain-height sampler — a lit,
 * subdivided grid instead of the flat quad, so relief shades and the tint texture drapes over it.
 */
import { sceneColors } from '@vers/design-system';
import type { BiomeField, Viewport } from '@vers/worldmap-core';
import { BIOME_ROSTER, buildBiomeField, getBiome, toHexPosition } from '@vers/worldmap-core';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  LinearFilter,
  RGBAFormat,
  UnsignedByteType,
} from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import invariant from 'tiny-invariant';
import { NODE_POSITION_SCALING_FACTOR } from '../consts';
import { useFogViewport } from '../state/use-fog-viewport';
import { useUserSeed } from '../state/use-user-seed';
import type { GroundHeightSampler } from './ground-relief';
import { makeGroundHeightSampler } from './ground-relief';
import type { TSLTextureNode } from './scene-tsl';
import { sceneTSL } from './scene-tsl';

const BIOME_TEXELS_PER_CELL = 4;

const BIOME_VIEWPORT_MARGIN_CELLS = 2;

/** target ground-grid vertices per axis before striding kicks in on huge viewports */
const MAX_GRID_VERTS = 160;

export function BiomeGround() {
  const userSeed = useUserSeed();
  const viewport = useFogViewport();

  const sampler = useMemo(
    () => (userSeed === null ? null : makeGroundHeightSampler(userSeed)),
    [userSeed],
  );

  const biome = useMemo(() => {
    if (userSeed === null || viewport === null || sampler === null) {
      return null;
    }

    const inflated: Viewport = {
      maxCX: viewport.maxCX + BIOME_VIEWPORT_MARGIN_CELLS,
      maxCY: viewport.maxCY + BIOME_VIEWPORT_MARGIN_CELLS,
      minCX: viewport.minCX - BIOME_VIEWPORT_MARGIN_CELLS,
      minCY: viewport.minCY - BIOME_VIEWPORT_MARGIN_CELLS,
    };

    return {
      field: buildBiomeField(userSeed, inflated, { resolution: BIOME_TEXELS_PER_CELL }),
      fieldViewport: inflated,
      sampler,
      userSeed,
    };
  }, [userSeed, viewport, sampler]);

  if (biome === null) {
    return null;
  }

  return (
    <BiomeGroundPlane
      field={biome.field}
      sampler={biome.sampler}
      userSeed={biome.userSeed}
      viewport={biome.fieldViewport}
    />
  );
}

interface BiomeGroundPlaneProps {
  readonly field: BiomeField;
  readonly sampler: GroundHeightSampler;
  readonly userSeed: number;
  readonly viewport: Viewport;
}

interface GroundBuffer {
  bytes: Uint8Array;
  cols: number;
  rows: number;
}

interface BiomeGroundResources {
  applied: { field: BiomeField; viewport: Viewport };
  readonly buffer: GroundBuffer;
  readonly material: MeshStandardNodeMaterial;
  readonly textureNode: TSLTextureNode;
}

const BIOME_GROUND_ELEVATION = -0.05;

function BiomeGroundPlane(props: Readonly<BiomeGroundPlaneProps>) {
  const planeRef = useRef<BiomeGroundResources | null>(null);
  const plane = (planeRef.current ??= buildBiomeGroundResources(props.field, props.viewport));

  // geometry derives in render so the mesh and its geometry swap atomically on a pan — an
  // effect-time swap leaves one frame draping the new area's texture over the old area's grid
  const geometry = useMemo(
    () => buildReliefGeometry(props.userSeed, props.sampler, props.viewport),
    [props.userSeed, props.sampler, props.viewport],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    updateBiomeGroundPlane(plane, props.field, props.viewport);
  }, [plane, props.field, props.viewport]);

  useEffect(
    () => () => {
      plane.material.dispose();
      plane.textureNode.value.dispose();
    },
    [plane],
  );

  return (
    <mesh geometry={geometry} material={plane.material} position={[0, 0, BIOME_GROUND_ELEVATION]} />
  );
}

function buildBiomeGroundResources(
  field: BiomeField,
  viewport: Readonly<Viewport>,
): BiomeGroundResources {
  const buffer: GroundBuffer = {
    bytes: new Uint8Array(field.cols * field.rows * 4),
    cols: field.cols,
    rows: field.rows,
  };

  updateGroundBytes(buffer.bytes, field);

  const textureNode = sceneTSL.texture(buildGroundTexture(buffer));

  const material = new MeshStandardNodeMaterial({ roughness: 0.95 });

  material.colorNode = sceneTSL.toNode(textureNode);

  return {
    applied: { field, viewport },
    buffer,
    material,
    textureNode,
  };
}

function updateBiomeGroundPlane(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- spike: mutable render resources
  plane: BiomeGroundResources,
  field: BiomeField,
  viewport: Readonly<Viewport>,
): void {
  if (plane.applied.field === field && plane.applied.viewport === viewport) {
    return;
  }

  plane.applied = { field, viewport };

  if (field.cols === plane.buffer.cols && field.rows === plane.buffer.rows) {
    updateGroundBytes(plane.buffer.bytes, field);

    plane.textureNode.value.needsUpdate = true;
  } else {
    plane.buffer.bytes = new Uint8Array(field.cols * field.rows * 4);

    plane.buffer.cols = field.cols;
    plane.buffer.rows = field.rows;

    updateGroundBytes(plane.buffer.bytes, field);

    const previous = plane.textureNode.value;

    plane.textureNode.value = buildGroundTexture(plane.buffer);

    previous.dispose();
  }

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

function updateGroundBytes(bytes: Uint8Array, field: BiomeField): void {
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
}

function getBaseTint(id: number): Color {
  const tint = BASE_TINTS.get(id);

  invariant(tint, 'every biome id the field draws appears in the roster tint table');

  return tint;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- spike: mutable texture backing store
function buildGroundTexture(buffer: GroundBuffer): DataTexture {
  const map = new DataTexture(buffer.bytes, buffer.cols, buffer.rows, RGBAFormat, UnsignedByteType);

  map.magFilter = LinearFilter;
  map.minFilter = LinearFilter;
  map.needsUpdate = true;

  return map;
}

/**
 * Subdivided grid over the viewport's cell box, displaced by the terrain sampler and lit, with uvs
 * spanning the box so the biome tint texture drapes over the relief.
 */
function buildReliefGeometry(
  userSeed: number,
  sampler: GroundHeightSampler,
  viewport: Readonly<Viewport>,
): BufferGeometry {
  const spanX = viewport.maxCX - viewport.minCX + 1;
  const spanY = viewport.maxCY - viewport.minCY + 1;
  const cols = Math.min(spanX * 2 + 1, MAX_GRID_VERTS);
  const rows = Math.min(spanY * 2 + 1, MAX_GRID_VERTS);
  const strideX = spanX / (cols - 1);
  const strideY = spanY / (rows - 1);
  const f = NODE_POSITION_SCALING_FACTOR;

  const positions = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);

  for (let j = 0; j < rows; j++) {
    const cy = viewport.minCY - 0.5 + j * strideY;

    for (let i = 0; i < cols; i++) {
      const cx = viewport.minCX - 0.5 + i * strideX;
      const [x, y] = toHexPosition(cx, cy);
      const biome = getBiome(userSeed, Math.round(cx), Math.round(cy)).baseID;
      const z = sampler(x, y, biome);
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
