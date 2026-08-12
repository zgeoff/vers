import { sceneColors } from '@vers/design-system';
import type { RevealDistanceField, Viewport } from '@vers/worldmap-core';
import { buildRevealDistanceField, toHexPosition } from '@vers/worldmap-core';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  LinearFilter,
  RedFormat,
  UnsignedByteType,
} from 'three';
import { mx_noise_float, positionWorld, texture, time } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { NODE_POSITION_SCALING_FACTOR } from '../consts';
import { useFogViewport } from '../state/use-fog-viewport';
import { useRevealSources } from '../state/use-reveal-sources';

const SHROUD_COLOR = sceneColors.fogShroud;

/**
 * Scene-space distance (in unit-hex units) over which fog eases from clear to fully opaque past a
 * reveal disc's edge. Wider reads gentler.
 */
const FOG_FALLOFF = 3;

/**
 * Density texels per axial cell unit. Higher resolves rounder gradient contours at the cost of a
 * proportionally larger texture rebuild per viewport change.
 */
const FOG_TEXELS_PER_CELL = 4;

/**
 * Cells the fog quad extends past the chunk-aligned viewport, covering the screen edge between a
 * fast pan and the next chunk-boundary rebuild.
 */
const FOG_VIEWPORT_MARGIN_CELLS = 2;

/**
 * The fog plane floats just above the node plane so dense fog hides the nodes and edges underneath
 * it.
 */
const FOG_ELEVATION = 0.2;

/**
 * Spatial frequency of the billow noise in world units — wavelengths around one to two cells read
 * as rolling fog banks rather than shimmer.
 */
const FOG_BILLOW_SCALE = 0.045;

/**
 * Peak opacity wobble in the middle of the frontier band. Higher makes the edge roil further.
 */
const FOG_BILLOW_EDGE = 0.35;

/**
 * Opacity wobble deep inside the fog, where the band term is 0 — a faint internal churn that keeps
 * dense fog from reading flat without ever clearing it.
 */
const FOG_BILLOW_DEEP = 0.08;

/**
 * Draws soft fog of war over the world map: one viewport-covering plane whose per-fragment opacity
 * samples a fog-density texture — the smootherstep-eased euclidean distance to the nearest reveal
 * disc, 0 over revealed ground and 1 a falloff past the frontier — modulated by drifting billow
 * noise. Purely presentational: it projects the density field from the store's reveal sources and
 * stores nothing itself, rebuilding only when a pan crosses a chunk boundary. It renders nothing
 * until both a viewport and reveal sources exist.
 */
export function FogOfWar() {
  const revealSources = useRevealSources();
  const viewport = useFogViewport();

  const fog = useMemo(() => {
    if (revealSources === null || viewport === null) {
      return null;
    }

    const inflated: Viewport = {
      maxCX: viewport.maxCX + FOG_VIEWPORT_MARGIN_CELLS,
      maxCY: viewport.maxCY + FOG_VIEWPORT_MARGIN_CELLS,
      minCX: viewport.minCX - FOG_VIEWPORT_MARGIN_CELLS,
      minCY: viewport.minCY - FOG_VIEWPORT_MARGIN_CELLS,
    };

    return {
      field: buildRevealDistanceField(revealSources, inflated, {
        falloff: FOG_FALLOFF,
        resolution: FOG_TEXELS_PER_CELL,
      }),
      fieldViewport: inflated,
    };
  }, [revealSources, viewport]);

  if (fog === null) {
    return null;
  }

  return <FogPlane field={fog.field} viewport={fog.fieldViewport} />;
}

interface FogPlaneProps {
  readonly field: RevealDistanceField;
  readonly viewport: Viewport;
}

/**
 * The geometry, material, and texture node live for the whole mount: a field change swaps the
 * texture node's value and rewrites the quad in place, never rebuilding the material. A fresh
 * material per change would recompile its shader pipeline on every rebuild, and that churn is
 * enough to lose the GPU context mid-pan — the canvas goes irrecoverably blank.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- RevealDistanceField carries a Float32Array, which has no readonly form
function FogPlane(props: Readonly<FogPlaneProps>) {
  const planeRef = useRef<FogPlaneResources | null>(null);
  const plane = (planeRef.current ??= buildFogPlaneResources(props.field, props.viewport));

  useLayoutEffect(() => {
    updateFogPlane(plane, props.field, props.viewport);
  }, [plane, props.field, props.viewport]);

  useEffect(
    () => () => {
      plane.geometry.dispose();
      plane.material.dispose();
      plane.textureNode.value.dispose();
    },
    [plane],
  );

  return <mesh geometry={plane.geometry} material={plane.material} />;
}

/**
 * Minimal structural view of a runtime TSL node, standing in for three's own operator types: every
 * operator there carries thousands of conditionally typed overloads and swizzle getters, and one
 * call sends the native compiler's inference into a multi-gigabyte runaway that OOMs the machine.
 * Only the operations this module's shader math uses appear here; the objects behind it are real
 * TSL nodes throughout, so the runtime graph is unchanged.
 */
interface FogMathNode {
  readonly add: (other: FogMathNode | number) => FogMathNode;
  readonly clamp: (min: number, max: number) => FogMathNode;
  readonly mul: (other: FogMathNode | number) => FogMathNode;
  readonly oneMinus: () => FogMathNode;
  readonly sub: (other: FogMathNode | number) => FogMathNode;
}

/**
 * The texture node keeps its sampled channel beside the mutable value slot: assigning a new
 * texture rebinds the sampler on the next frame without touching the compiled shader.
 */
interface FogTextureNode {
  readonly r: FogMathNode;
  value: DataTexture;
}

interface FogTSL {
  readonly mx_noise_float: (coord: FogMathNode) => FogMathNode;
  readonly positionWorld: { readonly xz: FogMathNode };
  readonly texture: (map: DataTexture) => FogTextureNode;
  readonly time: FogMathNode;
}

const fogTSLValues = { mx_noise_float, positionWorld, texture, time };

/**
 * The one boundary between three's node types and the minimal view above: everything the shader
 * math touches enters through this facade already narrowed, so the math itself carries no
 * assertions and the checker never opens three's operator types.
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the values are untouched runtime TSL builders; only the static view narrows
const fogTSL = fogTSLValues as unknown as FogTSL;

/**
 * The byte buffer behind the live density texture, kept beside its dimensions so a same-size
 * rebuild can rewrite the pixels in place.
 */
interface DensityBuffer {
  bytes: Uint8Array;
  cols: number;
  rows: number;
}

interface FogPlaneResources {
  readonly density: DensityBuffer;
  readonly geometry: BufferGeometry;
  readonly material: MeshBasicNodeMaterial;
  readonly textureNode: FogTextureNode;
}

function buildFogPlaneResources(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- RevealDistanceField carries a Float32Array, which has no readonly form
  field: RevealDistanceField,
  viewport: Readonly<Viewport>,
): FogPlaneResources {
  const density: DensityBuffer = {
    bytes: new Uint8Array(field.values.length),
    cols: field.cols,
    rows: field.rows,
  };

  updateDensityBytes(density.bytes, field);

  const textureNode = fogTSL.texture(buildDensityTexture(density));

  const material = new MeshBasicNodeMaterial({
    color: SHROUD_COLOR,
    depthWrite: false,
    transparent: true,
  });

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the finished graph leaves the minimal node view; the value is a real runtime TSL node
  material.opacityNode = buildBillowedOpacity(textureNode.r) as unknown as Node;

  const geometry = new BufferGeometry();

  updateFogPlaneGeometry(geometry, viewport);

  return { density, geometry, material, textureNode };
}

/**
 * A same-size field — every pan; only a zoom changes the texel dimensions — rewrites the live
 * texture's pixels in place: no new GPU texture and, above all, no disposal, since destroying a
 * texture a queued frame still binds is a device loss on the WebGPU backend and a silently blank
 * canvas. Only a resize allocates a replacement, and the old texture is released only after the
 * node stops referencing it.
 */
function updateFogPlane(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the resources' density buffer and texture-node value slot are mutable by design: rewriting them is how a rebuilt field reaches the live material
  plane: FogPlaneResources,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- RevealDistanceField carries a Float32Array, which has no readonly form
  field: RevealDistanceField,
  viewport: Readonly<Viewport>,
): void {
  if (field.cols === plane.density.cols && field.rows === plane.density.rows) {
    updateDensityBytes(plane.density.bytes, field);

    plane.textureNode.value.needsUpdate = true;
  } else {
    plane.density.bytes = new Uint8Array(field.values.length);

    plane.density.cols = field.cols;
    plane.density.rows = field.rows;

    updateDensityBytes(plane.density.bytes, field);

    const previous = plane.textureNode.value;

    plane.textureNode.value = buildDensityTexture(plane.density);

    previous.dispose();
  }

  updateFogPlaneGeometry(plane.geometry, viewport);
}

function updateDensityBytes(
  bytes: Uint8Array,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- RevealDistanceField carries a Float32Array, which has no readonly form
  field: RevealDistanceField,
): void {
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Math.round((field.values[index] ?? 0) * 255);
  }
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the density buffer is mutable by design: it backs the live texture's pixel storage
function buildDensityTexture(density: DensityBuffer): DataTexture {
  const map = new DataTexture(
    density.bytes,
    density.cols,
    density.rows,
    RedFormat,
    UnsignedByteType,
  );

  // bilinear sampling between texel centers is what turns the texel grid into a continuous
  // gradient
  map.magFilter = LinearFilter;
  map.minFilter = LinearFilter;
  map.needsUpdate = true;

  return map;
}

/**
 * Rewrites the quad as one parallelogram covering the viewport's cell box in scene space. The
 * axial-to-scene mapping is linear, so the quad's uv interpolation lands each density texel's
 * center exactly on the axial coordinate it was sampled at; the half-cell margin matches the
 * field's texel layout.
 */
function updateFogPlaneGeometry(geometry: BufferGeometry, viewport: Readonly<Viewport>): void {
  const corners = [
    toHexPosition(viewport.minCX - 0.5, viewport.minCY - 0.5),
    toHexPosition(viewport.maxCX + 0.5, viewport.minCY - 0.5),
    toHexPosition(viewport.minCX - 0.5, viewport.maxCY + 0.5),
    toHexPosition(viewport.maxCX + 0.5, viewport.maxCY + 0.5),
  ];

  const positions = new Float32Array(
    corners.flatMap(([x, y]) => [
      x * NODE_POSITION_SCALING_FACTOR,
      y * NODE_POSITION_SCALING_FACTOR,
      FOG_ELEVATION,
    ]),
  );

  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  geometry.computeBoundingSphere();
}

/**
 * Two octaves of world-anchored noise drifting in opposite directions, so the fog reads as a
 * living volume rather than a static gradient. The billow is strongest in the frontier band —
 * `density * (1 - density)` peaks mid-gradient and vanishes at both ends — with a small
 * density-proportional term so deep fog keeps a faint internal churn; clamping restores the 0..1
 * opacity range. Noise coordinates come from world position, not uv, so drifting the camera never
 * drags the billow along with the quad; the time term broadcast onto both axes blows the noise
 * field diagonally, like wind.
 */
function buildBillowedOpacity(density: FogMathNode): FogMathNode {
  const ground = fogTSL.positionWorld.xz;
  const clock = fogTSL.time;
  const band = density.mul(density.oneMinus()).mul(4);
  const drift = ground.mul(FOG_BILLOW_SCALE);
  const coarse = fogTSL.mx_noise_float(drift.add(clock.mul(0.24)));
  const fine = fogTSL.mx_noise_float(drift.mul(2.3).sub(clock.mul(0.31)));
  const billow = coarse.mul(0.7).add(fine.mul(0.3));
  const amplitude = band.mul(FOG_BILLOW_EDGE).add(density.mul(FOG_BILLOW_DEEP));

  return density.add(billow.mul(amplitude)).clamp(0, 1);
}
