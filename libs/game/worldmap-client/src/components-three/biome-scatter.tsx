/**
 * SPIKE: throwaway procgen scatter grammar — instanced primitive assemblies seeded per cell, for
 * feeling out biome silhouettes. Three layers: ambient scatter (avoids roads and nodes), node
 * structures (deliberate, archetype-drawn per node), and emissive accents. Not production code.
 */
import type { Viewport, WorldMapNode } from '@vers/worldmap-core';
import {
  buildCellNode,
  buildCoordHashUnit,
  buildValueNoise,
  collectNodeEdges,
  getBiome,
  toHexPosition,
} from '@vers/worldmap-core';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { InstancedMesh } from 'three';
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import { extend } from '@react-three/fiber';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { NODE_POSITION_SCALING_FACTOR } from '../consts';
import { useFogViewport } from '../state/use-fog-viewport';
import { useIsScatterVisible } from '../state/use-is-scatter-visible';
import { useUserSeed } from '../state/use-user-seed';

const ScatterMaterial = extend(MeshStandardNodeMaterial);
const GlowMaterial = extend(MeshBasicNodeMaterial);

/** hash-channel base for all scatter draws — far above the registered channels */
const CH = 100;

/** half-width of the scatter window around the viewport center, in cells */
const WINDOW = 24;

const MAX_PARTS = 30000;
const MAX_GLOW = 6000;

/** keep-out radius around a node's jittered position, hex units */
const NODE_CLEARANCE = 0.42;

/** keep-out half-width along an edge corridor, hex units */
const EDGE_CLEARANCE = 0.16;

/** global multiplier on assembly dimensions — props are texture between nodes, not monuments */
const PROP_SCALE = 0.55;

/** node structures stay a little grander than ambient scatter */
const NODE_STRUCT_SCALE = 0.75;

/** peak props per cell by base biome id, reached only inside a cluster hotspot */
const PEAK_DENSITY = [5, 16, 1, 9];

/** cluster-field frequency per biome — lower = broader clumps and wider voids */
const CLUSTER_FREQ = [0.4, 0.28, 0.5, 0.22];

/** cluster contrast exponent per biome — higher = tighter hotspots, emptier voids */
const CLUSTER_POW = [2.5, 3, 4, 2.2];

/** minimum spacing between props in the same cell, hex units */
const MIN_SEPARATION = 0.18;

/** chance per cell of an isolated landmark assembly, independent of clustering */
const LANDMARK_CHANCE = 0.012;

/** base part color per biome */
const PALETTE = [
  new Color('#8fa0c2'),
  new Color('#6f8f6f'),
  new Color('#5a5f6a'),
  new Color('#9a8f84'),
];

const GLOW_COLOR = new Color('#7dd3fc');

interface ScatterBuild {
  colors: Float32Array;
  count: number;
  glowCount: number;
  glowMatrices: Float32Array;
  id: string;
  matrices: Float32Array;
}

export function BiomeScatter() {
  const userSeed = useUserSeed();
  const viewport = useFogViewport();
  const isVisible = useIsScatterVisible();

  const build = useMemo(() => {
    if (userSeed === null || viewport === null) {
      return null;
    }

    return buildScatter(userSeed, viewport);
  }, [userSeed, viewport]);

  if (!isVisible || build === null || build.count === 0) {
    return null;
  }

  return (
    <>
      <directionalLight intensity={1.4} position={[30, -40, 80]} />
      <ScatterParts key={build.id} build={build} />
    </>
  );
}

const tempColor = new Color();

function ScatterParts({ build }: Readonly<{ build: ScatterBuild }>) {
  const meshRef = useRef<InstancedMesh | null>(null);
  const glowRef = useRef<InstancedMesh | null>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;

    if (mesh !== null) {
      for (let i = 0; i < build.count; i++) {
        mesh.instanceMatrix.array.set(build.matrices.subarray(i * 16, i * 16 + 16), i * 16);
        mesh.setColorAt(i, tempColor.fromArray(build.colors, i * 3));
      }

      mesh.instanceMatrix.needsUpdate = true;

      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }

      mesh.computeBoundingSphere();
    }

    const glow = glowRef.current;

    if (glow !== null && build.glowCount > 0) {
      for (let i = 0; i < build.glowCount; i++) {
        glow.instanceMatrix.array.set(build.glowMatrices.subarray(i * 16, i * 16 + 16), i * 16);
      }

      glow.instanceMatrix.needsUpdate = true;

      glow.computeBoundingSphere();
    }
  }, [build]);

  return (
    <>
      <instancedMesh args={[undefined, undefined, build.count]} frustumCulled={false} ref={meshRef}>
        <boxGeometry args={[1, 1, 1]} />
        <ScatterMaterial roughness={0.85} />
      </instancedMesh>
      {build.glowCount > 0 && (
        <instancedMesh
          args={[undefined, undefined, build.glowCount]}
          frustumCulled={false}
          ref={glowRef}
        >
          <boxGeometry args={[1, 1, 1]} />
          <GlowMaterial color={GLOW_COLOR} />
        </instancedMesh>
      )}
    </>
  );
}

interface EdgeSegment {
  readonly ex: number;
  readonly ey: number;
  readonly sx: number;
  readonly sy: number;
}

interface PartsSink {
  colors: Float32Array;
  count: number;
  glowCount: number;
  glowMatrices: Float32Array;
  matrices: Float32Array;
}

const tempMatrix = new Matrix4();
const tempPosition = new Vector3();
const tempQuaternion = new Quaternion();
const tempTilt = new Quaternion();
const tempScale = new Vector3();
const UP = new Vector3(0, 0, 1);
const TILT_AXIS = new Vector3(1, 0, 0);

function buildScatter(userSeed: number, viewport: Readonly<Viewport>): ScatterBuild {
  const centerX = Math.round((viewport.minCX + viewport.maxCX) / 2);
  const centerY = Math.round((viewport.minCY + viewport.maxCY) / 2);
  const minCX = Math.max(viewport.minCX, centerX - WINDOW);
  const maxCX = Math.min(viewport.maxCX, centerX + WINDOW);
  const minCY = Math.max(viewport.minCY, centerY - WINDOW);
  const maxCY = Math.min(viewport.maxCY, centerY + WINDOW);

  const sink: PartsSink = {
    colors: new Float32Array(MAX_PARTS * 3),
    count: 0,
    glowCount: 0,
    glowMatrices: new Float32Array(MAX_GLOW * 16),
    matrices: new Float32Array(MAX_PARTS * 16),
  };

  const nodes = new Map<string, WorldMapNode>();

  const getNode = (cx: number, cy: number): WorldMapNode => {
    const key = `${cx}_${cy}`;
    let node = nodes.get(key);

    if (node === undefined) {
      node = buildCellNode(userSeed, cx, cy);
      nodes.set(key, node);
    }

    return node;
  };

  const edgeCache = new Map<string, ReadonlyArray<EdgeSegment>>();

  const getEdges = (cx: number, cy: number): ReadonlyArray<EdgeSegment> => {
    const key = `${cx}_${cy}`;
    let segments = edgeCache.get(key);

    if (segments === undefined) {
      segments = collectNodeEdges(userSeed, cx, cy).map((edge) => {
        const start = getNode(edge.start[0], edge.start[1]).position;
        const end = getNode(edge.end[0], edge.end[1]).position;

        return { ex: end[0], ey: end[1], sx: start[0], sy: start[1] };
      });
      edgeCache.set(key, segments);
    }

    return segments;
  };

  const isClear = (x: number, y: number): boolean => {
    const axialY = y / 1.5;
    const axialX = x / 1.7320508 - axialY / 2;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cellX = Math.round(axialX) + dx;
        const cellY = Math.round(axialY) + dy;
        const node = getNode(cellX, cellY);
        const nx = x - node.position[0];
        const ny = y - node.position[1];

        if (nx * nx + ny * ny < NODE_CLEARANCE * NODE_CLEARANCE) {
          return false;
        }

        for (const s of getEdges(cellX, cellY)) {
          if (getSegmentDistanceSq(x, y, s) < EDGE_CLEARANCE * EDGE_CLEARANCE) {
            return false;
          }
        }
      }
    }

    return true;
  };

  for (let cy = minCY; cy <= maxCY; cy++) {
    for (let cx = minCX; cx <= maxCX; cx++) {
      const biome = getBiome(userSeed, cx, cy).baseID;
      const cellDraw = (salt: number) => buildCoordHashUnit(userSeed, cx, cy, CH + salt);
      const freq = CLUSTER_FREQ[biome] ?? 0.3;
      const cluster = Math.pow(
        buildValueNoise(userSeed, cx * freq, cy * freq, CH + 3),
        CLUSTER_POW[biome] ?? 2.5,
      );
      const props = Math.floor(cellDraw(0) * (PEAK_DENSITY[biome] ?? 2) * cluster * 2);
      const placed: Array<readonly [number, number]> = [];

      for (let p = 0; p < props; p++) {
        const draw = (salt: number) =>
          buildCoordHashUnit(userSeed, cx, cy, CH + 10 + p * 60 + salt);
        const [hexX, hexY] = toHexPosition(cx, cy);
        const x = hexX + (draw(0) - 0.5) * 1.5;
        const y = hexY + (draw(1) - 0.5) * 1.5;

        if (!isClear(x, y) || !hasSeparation(placed, x, y)) {
          continue;
        }

        placed.push([x, y]);

        if (biome === 1) {
          buildAntennaTree(draw, x, y, sink);
        } else {
          buildStack(draw, x, y, biome, sink, isClear);
        }
      }

      if (cellDraw(5) < LANDMARK_CHANCE) {
        const draw = (salt: number) => buildCoordHashUnit(userSeed, cx, cy, CH + 900 + salt);
        const [hexX, hexY] = toHexPosition(cx, cy);
        const x = hexX + (draw(0) - 0.5) * 0.9;
        const y = hexY + (draw(1) - 0.5) * 0.9;

        if (isClear(x, y)) {
          buildLandmark(draw, x, y, biome, sink);
        }
      }

      // node structure: a deliberate assembly tied to the cell's node, drawn per archetype
      buildNodeStructure(userSeed, cx, cy, getNode(cx, cy), biome, sink);
    }
  }

  return {
    colors: sink.colors,
    count: sink.count,
    glowCount: sink.glowCount,
    glowMatrices: sink.glowMatrices,
    id: `${userSeed}:${minCX}:${minCY}:${maxCX}:${maxCY}`,
    matrices: sink.matrices,
  };
}

function hasSeparation(
  placed: ReadonlyArray<readonly [number, number]>,
  x: number,
  y: number,
): boolean {
  for (const [px, py] of placed) {
    const dx = px - x;
    const dy = py - y;

    if (dx * dx + dy * dy < MIN_SEPARATION * MIN_SEPARATION) {
      return false;
    }
  }

  return true;
}

function getSegmentDistanceSq(x: number, y: number, s: EdgeSegment): number {
  const dx = s.ex - s.sx;
  const dy = s.ey - s.sy;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - s.sx) * dx + (y - s.sy) * dy) / lengthSq));
  const px = s.sx + t * dx - x;
  const py = s.sy + t * dy - y;

  return px * px + py * py;
}

function pushPart(
  sink: PartsSink,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  spin: number,
  tilt: number,
  color: Readonly<Color>,
  shade: number,
): void {
  if (sink.count >= MAX_PARTS) {
    return;
  }

  const f = NODE_POSITION_SCALING_FACTOR;

  tempPosition.set(x * f, y * f, z * f);
  tempQuaternion.setFromAxisAngle(UP, spin);

  if (tilt !== 0) {
    tempTilt.setFromAxisAngle(TILT_AXIS, tilt);
    tempQuaternion.multiply(tempTilt);
  }

  tempScale.set(w * f, d * f, h * f);
  tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
  tempMatrix.toArray(sink.matrices, sink.count * 16);

  sink.colors[sink.count * 3] = color.r * shade;
  sink.colors[sink.count * 3 + 1] = color.g * shade;
  sink.colors[sink.count * 3 + 2] = color.b * shade;

  sink.count += 1;
}

function pushGlow(sink: PartsSink, x: number, y: number, z: number, size: number): void {
  if (sink.glowCount >= MAX_GLOW) {
    return;
  }

  const f = NODE_POSITION_SCALING_FACTOR;

  tempPosition.set(x * f, y * f, z * f);
  tempQuaternion.identity();
  tempScale.set(size * f, size * f, size * f);
  tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
  tempMatrix.toArray(sink.glowMatrices, sink.glowCount * 16);

  sink.glowCount += 1;
}

/**
 * Ruin/maintained stack: tapered segments; the mauve ruin biome leans and sometimes topples.
 */
function buildStack(
  draw: (salt: number) => number,
  x: number,
  y: number,
  biome: number,
  sink: PartsSink,
  isClear: (x: number, y: number) => boolean,
): void {
  const segments = 2 + Math.floor(draw(2) * 4);
  const girth = (0.15 + draw(3) * 0.3) * PROP_SCALE;
  const segmentHeight = (0.25 + draw(4) * 0.5) * PROP_SCALE;
  const spin = draw(5) * Math.PI;
  const base = PALETTE[biome] ?? PALETTE[0]!;
  const isRuin = biome === 3;
  const lean = isRuin ? (draw(6) - 0.5) * 0.35 : 0;
  const toppled = isRuin && draw(7) > 0.75;

  if (toppled) {
    // a fallen column: segments laid end to end, the train breaking where it would cross a road
    const w = girth;

    for (let s = 0; s < segments; s++) {
      const h = segmentHeight * (0.8 + draw(20 + s) * 0.4);
      const along = s * segmentHeight * 1.1;
      const px = x + Math.cos(spin) * along;
      const py = y + Math.sin(spin) * along;

      if (!isClear(px, py)) {
        break;
      }

      pushPart(sink, px, py, w / 2, w, w, h, spin, Math.PI / 2, base, 0.7 + draw(30 + s) * 0.3);
    }

    return;
  }

  let z = 0;

  for (let s = 0; s < segments; s++) {
    const taper = Math.pow(0.82, s);
    const w = girth * taper;
    const h = segmentHeight * (0.8 + draw(20 + s) * 0.4);

    pushPart(
      sink,
      x + Math.sin(lean) * z,
      y,
      z + h / 2,
      w,
      w,
      h,
      spin + (draw(5) - 0.5) * 0.5 * s,
      lean,
      base,
      0.8 + draw(30 + s) * 0.4,
    );

    z += h;
  }
}

/**
 * Grown Works antenna-tree: a thin mast with recursive branch tiers and a glowing tip.
 */
function buildAntennaTree(
  draw: (salt: number) => number,
  x: number,
  y: number,
  sink: PartsSink,
): void {
  const base = PALETTE[1]!;
  const height = (0.9 + draw(2) * 1.4) * PROP_SCALE;
  const mastW = (0.05 + draw(3) * 0.04) * PROP_SCALE;

  pushPart(sink, x, y, height / 2, mastW, mastW, height, 0, 0, base, 0.75 + draw(4) * 0.3);

  const tiers = 1 + Math.floor(draw(5) * 3);

  for (let t = 0; t < tiers; t++) {
    const tierZ = height * (0.45 + 0.5 * (t / Math.max(1, tiers)));
    const arms = 2 + Math.floor(draw(10 + t) * 3);

    for (let a = 0; a < arms; a++) {
      const angle = draw(20 + t * 5 + a) * Math.PI * 2;
      const len = (0.15 + draw(30 + t * 5 + a) * 0.3) * PROP_SCALE;
      const armW = mastW * 0.6;

      pushPart(
        sink,
        x + Math.cos(angle) * (len / 2),
        y + Math.sin(angle) * (len / 2),
        tierZ,
        len,
        armW,
        armW,
        angle,
        0,
        base,
        0.7 + draw(40 + t) * 0.3,
      );
    }
  }

  if (draw(50) > 0.35) {
    pushGlow(sink, x, y, height + 0.03, (0.05 + draw(51) * 0.04) * PROP_SCALE);
  }
}

/**
 * A deliberate structure tied to the node itself — the place you travel to. Archetype comes off the
 * node's own hash: most nodes stay plain, some get a ring of posts, some a pylon pair, rare ones a
 * spire beside the disc.
 */
function buildNodeStructure(
  userSeed: number,
  cx: number,
  cy: number,
  node: Readonly<WorldMapNode>,
  biome: number,
  sink: PartsSink,
): void {
  const draw = (salt: number) => buildCoordHashUnit(userSeed, cx, cy, CH + 500 + salt);
  const archetype = draw(0);
  const [x, y] = node.position;
  const base = PALETTE[biome] ?? PALETTE[0]!;

  if (archetype < 0.55) {
    return;
  }

  if (archetype < 0.8) {
    // post ring
    const posts = 4 + Math.floor(draw(1) * 3);
    const radius = 0.5 + draw(2) * 0.1;
    const phase = draw(3) * Math.PI * 2;

    for (let i = 0; i < posts; i++) {
      const angle = phase + (i / posts) * Math.PI * 2;
      const h = (0.12 + draw(10 + i) * 0.1) * NODE_STRUCT_SCALE;

      pushPart(
        sink,
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius,
        h / 2,
        0.045 * NODE_STRUCT_SCALE,
        0.045 * NODE_STRUCT_SCALE,
        h,
        angle,
        0,
        base,
        0.9,
      );
    }

    return;
  }

  if (archetype < 0.95) {
    // pylon pair flanking the node
    const angle = draw(4) * Math.PI * 2;
    const radius = 0.55;
    const h = (0.5 + draw(5) * 0.4) * NODE_STRUCT_SCALE;

    for (const side of [0, Math.PI]) {
      pushPart(
        sink,
        x + Math.cos(angle + side) * radius,
        y + Math.sin(angle + side) * radius,
        h / 2,
        0.07 * NODE_STRUCT_SCALE,
        0.07 * NODE_STRUCT_SCALE,
        h,
        angle,
        0,
        base,
        1,
      );
      pushGlow(sink, x + Math.cos(angle + side) * radius, y + Math.sin(angle + side) * radius, h + 0.03, 0.045 * NODE_STRUCT_SCALE);
    }

    return;
  }

  // rare spire beside the disc
  const angle = draw(6) * Math.PI * 2;
  const sx = x + Math.cos(angle) * 0.55;
  const sy = y + Math.sin(angle) * 0.55;
  let z = 0;

  for (let s = 0; s < 5; s++) {
    const taper = Math.pow(0.78, s);
    const w = 0.22 * taper * NODE_STRUCT_SCALE;
    const h = 0.35 * (0.85 + draw(20 + s) * 0.3) * NODE_STRUCT_SCALE;

    pushPart(sink, sx, sy, z + h / 2, w, w, h, draw(7) * Math.PI, 0, base, 0.95);

    z += h;
  }

  pushGlow(sink, sx, sy, z + 0.04, 0.07 * NODE_STRUCT_SCALE);
}

/**
 * Rare isolated mega-assembly: a broad stepped base with a tall crowned mast, so empty stretches
 * still carry one thing on the horizon.
 */
function buildLandmark(
  draw: (salt: number) => number,
  x: number,
  y: number,
  biome: number,
  sink: PartsSink,
): void {
  const base = PALETTE[biome] ?? PALETTE[0]!;
  let z = 0;

  for (let s = 0; s < 3; s++) {
    const w = 0.7 * Math.pow(0.6, s) * PROP_SCALE;
    const h = (0.22 + draw(10 + s) * 0.1) * PROP_SCALE;

    pushPart(sink, x, y, z + h / 2, w, w, h, draw(2) * Math.PI, 0, base, 0.85 + s * 0.05);

    z += h;
  }

  const mastH = (1.6 + draw(3) * 1.2) * PROP_SCALE;

  pushPart(sink, x, y, z + mastH / 2, 0.09 * PROP_SCALE, 0.09 * PROP_SCALE, mastH, 0, 0, base, 1);
  pushGlow(sink, x, y, z + mastH + 0.05, 0.09 * PROP_SCALE);
}
