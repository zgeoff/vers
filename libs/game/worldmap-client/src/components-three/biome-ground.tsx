import { sceneColors } from '@vers/design-system';
import type { BiomeField, Viewport } from '@vers/worldmap-core';
import { BIOME_ROSTER, buildBiomeField, toHexPosition } from '@vers/worldmap-core';
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
import { texture } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import invariant from 'tiny-invariant';
import { NODE_POSITION_SCALING_FACTOR } from '../consts';
import { useFogViewport } from '../state/use-fog-viewport';
import { useUserSeed } from '../state/use-user-seed';

/**
 * Biome texels per axial cell unit. Modest by design: each texel walks the full Worley/value-noise
 * sample, so the resolution trades border smoothness against per-pan rebuild cost.
 */
const BIOME_TEXELS_PER_CELL = 4;

/**
 * Cells the ground quad extends past the chunk-aligned viewport, covering the screen edge between a
 * fast pan and the next chunk-boundary rebuild.
 */
const BIOME_VIEWPORT_MARGIN_CELLS = 2;

/**
 * Draws the placeholder biome terrain tint over the world map: one viewport-covering plane whose
 * per-fragment color samples a CPU-mixed RGBA texture — the base biome blended toward its border
 * neighbour by `blendT`, with the modifier tint overlaid at low alpha where the modifier layer draws
 * non-`none`. Purely presentational flavour: it projects the biome field from the current region's
 * seed and stores nothing itself, rebuilding only when a pan crosses a chunk boundary. It renders
 * nothing until both a seed and a viewport exist.
 */
export function BiomeGround() {
  const userSeed = useUserSeed();
  const viewport = useFogViewport();

  const biome = useMemo(() => {
    if (userSeed === null || viewport === null) {
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
    };
  }, [userSeed, viewport]);

  if (biome === null) {
    return null;
  }

  return <BiomeGroundPlane field={biome.field} viewport={biome.fieldViewport} />;
}

interface BiomeGroundPlaneProps {
  readonly field: BiomeField;
  readonly viewport: Viewport;
}

/**
 * The byte buffer behind the live ground texture, kept beside its dimensions so a same-size rebuild
 * can rewrite the pixels in place.
 */
interface GroundBuffer {
  bytes: Uint8Array;
  cols: number;
  rows: number;
}

/**
 * Minimal structural view of a runtime TSL texture node, standing in for three's own node types:
 * every node there carries thousands of conditionally typed overloads and swizzle getters, and
 * touching the real type sends the native compiler's inference into a multi-gigabyte runaway that
 * OOMs the machine. Only the mutable value slot this module touches appears here; the object behind
 * it is the real TSL texture node throughout, so the runtime graph is unchanged.
 */
interface GroundTextureNode {
  value: DataTexture;
}

interface BiomeGroundResources {
  applied: { field: BiomeField; viewport: Viewport };
  readonly buffer: GroundBuffer;
  readonly geometry: BufferGeometry;
  readonly material: MeshBasicNodeMaterial;
  readonly textureNode: GroundTextureNode;
}

/**
 * The ground plane sits between the floor (`y = -0.1`) and the node/edge/fog plane (`y = 0`), inside
 * the scene's rotated group where a local z maps directly to world y.
 */
const BIOME_GROUND_ELEVATION = -0.05;

/**
 * The geometry, material, and texture node live for the whole mount: a field change swaps the
 * texture node's value and rewrites the quad in place, never rebuilding the material — the same
 * discipline `FogOfWar` follows, for the same reason: a fresh material recompiles its shader
 * pipeline, and that churn is enough to lose the GPU context mid-pan.
 */
function BiomeGroundPlane(props: Readonly<BiomeGroundPlaneProps>) {
  const planeRef = useRef<BiomeGroundResources | null>(null);
  const plane = (planeRef.current ??= buildBiomeGroundResources(props.field, props.viewport));

  useLayoutEffect(() => {
    updateBiomeGroundPlane(plane, props.field, props.viewport);
  }, [plane, props.field, props.viewport]);

  useEffect(
    () => () => {
      plane.geometry.dispose();
      plane.material.dispose();
      plane.textureNode.value.dispose();
    },
    [plane],
  );

  return (
    <mesh
      geometry={plane.geometry}
      material={plane.material}
      position={[0, 0, BIOME_GROUND_ELEVATION]}
    />
  );
}

interface GroundTSL {
  readonly texture: (map: DataTexture) => GroundTextureNode;
  readonly toNode: (node: Readonly<GroundTextureNode>) => Node<'vec4'>;
}

const groundTSLValues = {
  texture,
  toNode: (node: unknown) => node,
};

/**
 * The one boundary between three's node types and the minimal view above: `texture` is the
 * untouched runtime TSL builder; only the static view narrows what tsc ever elaborates.
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the values are untouched runtime TSL builders; only the static view narrows
const groundTSL = groundTSLValues as unknown as GroundTSL;

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

  const textureNode = groundTSL.texture(buildGroundTexture(buffer));

  const material = new MeshBasicNodeMaterial();

  material.colorNode = groundTSL.toNode(textureNode);

  return {
    applied: { field, viewport },
    buffer,
    geometry: buildBiomeGroundGeometry(viewport),
    material,
    textureNode,
  };
}

/**
 * A same-size field — every pan; only a zoom changes the texel dimensions — rewrites the live
 * texture's pixels in place: no new GPU texture, and no disposal of one a queued frame still binds.
 * Only a resize allocates a replacement, and the old texture is released only after the node stops
 * referencing it.
 */
function updateBiomeGroundPlane(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the resources' buffer and texture-node value slot are mutable by design: rewriting them is how a rebuilt field reaches the live material
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

  updateBiomeGroundGeometry(plane.geometry, viewport);
}

const BASE_TINT_HEXES: ReadonlyArray<string> = [
  sceneColors.biome1,
  sceneColors.biome2,
  sceneColors.biome3,
  sceneColors.biome4,
];

/**
 * Base-biome placeholder tints keyed by roster id, one entry per roster entry: growing the roster
 * without pairing the new biome with a tint fails loudly at module load, never by silently painting
 * the new biome with another biome's color.
 */
const BASE_TINTS: ReadonlyMap<number, Color> = new Map(
  BIOME_ROSTER.map((entry, index) => {
    const hex = BASE_TINT_HEXES[index];

    invariant(hex !== undefined, 'every base-biome roster entry carries a placeholder tint');

    return [entry.id, new Color(hex)];
  }),
);

const MODIFIER_TINT = new Color(sceneColors.modifierOverlay);

/**
 * Blend strength the modifier tint overlays at where the modifier layer draws non-`none`.
 */
const MODIFIER_OVERLAY_ALPHA = 0.35;

/**
 * CPU-mixes each texel's RGBA byte: the base tint blended toward the border neighbour's tint by
 * half `blendT`, then the modifier tint overlaid at `MODIFIER_OVERLAY_ALPHA` where the modifier
 * layer drew non-`none`. Alpha is always opaque — the ground plane replaces the floor's color
 * within its footprint outright, it never shows the floor through.
 */
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

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the buffer is mutable by design: it backs the live texture's pixel storage
function buildGroundTexture(buffer: GroundBuffer): DataTexture {
  const map = new DataTexture(buffer.bytes, buffer.cols, buffer.rows, RGBAFormat, UnsignedByteType);

  map.magFilter = LinearFilter;
  map.minFilter = LinearFilter;
  map.needsUpdate = true;

  return map;
}

/**
 * One parallelogram quad whose attribute buffers live as long as the geometry: the position
 * attribute is rewritten in place on every later viewport change, since replacing an attribute
 * object strands its GPU buffer until the whole geometry is disposed.
 */
function buildBiomeGroundGeometry(viewport: Readonly<Viewport>): BufferGeometry {
  const geometry = new BufferGeometry();

  geometry.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);

  updateBiomeGroundGeometry(geometry, viewport);

  return geometry;
}

/**
 * Rewrites the quad's corners to cover the viewport's cell box in scene space, the same axial-to-uv
 * mapping `buildBiomeField` samples its texels from.
 */
function updateBiomeGroundGeometry(geometry: BufferGeometry, viewport: Readonly<Viewport>): void {
  const corners = [
    toHexPosition(viewport.minCX - 0.5, viewport.minCY - 0.5),
    toHexPosition(viewport.maxCX + 0.5, viewport.minCY - 0.5),
    toHexPosition(viewport.minCX - 0.5, viewport.maxCY + 0.5),
    toHexPosition(viewport.maxCX + 0.5, viewport.maxCY + 0.5),
  ];

  const position = geometry.getAttribute('position');

  for (const [index, [x, y]] of corners.entries()) {
    position.setXYZ(index, x * NODE_POSITION_SCALING_FACTOR, y * NODE_POSITION_SCALING_FACTOR, 0);
  }

  position.needsUpdate = true;

  geometry.computeBoundingSphere();
}
