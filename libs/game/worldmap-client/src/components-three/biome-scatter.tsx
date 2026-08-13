/**
 * SPIKE: throwaway procgen scatter grammar — instanced primitive assemblies seeded per cell, for
 * feeling out biome silhouettes. Three layers: ambient scatter (avoids roads and nodes), node
 * structures (deliberate, archetype-drawn per node), and emissive accents. Not production code.
 */
import type { Viewport, WorldMapNode } from '@vers/worldmap-core';
import {
  ORIGIN_CELL,
  buildCellNode,
  buildCoordHashUnit,
  buildValueNoise,
  collectNodeEdges,
  getBiome,
  getHexDistance,
  toHexPosition,
} from '@vers/worldmap-core';
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import { NODE_POSITION_SCALING_FACTOR } from '../consts';

/** hash-channel base for all scatter draws — far above the registered channels */
const CH = 100;

const MAX_PARTS = 12288;
const MAX_GLOW = 2048;
const MAX_PILLARS = 8;

/** capacity of the persistent viewport-concat meshes, spanning many chunks */
export const CONCAT_PARTS = 90000;
export const CONCAT_GLOW = 18000;

/** keep-out radius around a node's jittered position, hex units */
const NODE_CLEARANCE = 0.42;

/** keep-out half-width along an edge corridor, hex units */
const EDGE_CLEARANCE = 0.16;

/** global multiplier on assembly dimensions — props are texture between nodes, not monuments */
const PROP_SCALE = 0.55;

/** node structures stay a little grander than ambient scatter */
const NODE_STRUCT_SCALE = 0.75;

/** peak props per cell by base biome id, reached only inside a cluster hotspot */
const PEAK_DENSITY = [7, 22, 1, 12];

/** cluster-field frequency per biome — lower = broader clumps and wider voids */
const CLUSTER_FREQ = [0.4, 0.28, 0.5, 0.22];

/** cluster contrast exponent per biome — higher = tighter hotspots, emptier voids */
const CLUSTER_POW = [2.5, 3, 4, 2.2];

/** minimum spacing between props in the same cell, hex units */
const MIN_SEPARATION = 0.18;

/** chance per cell of an isolated landmark assembly, independent of clustering */
const LANDMARK_CHANCE = 0.012;

/** ground-layer debris pieces per cell at a cluster hotspot, by biome */
const DEBRIS_DENSITY = [7, 5, 2, 12];

/** cluster-independent background debris per cell, so voids read quiet rather than dead */
const DEBRIS_BASE = 2.5;

/** base part color per biome — crusted dark metals, no naturalism */
const PALETTE = [
  new Color('#7286ab'),
  new Color('#5d7264'),
  new Color('#585267'),
  new Color('#96714f'),
];

/** per-biome neon accent for emissives — the unnatural highlight against the dark world */
const ACCENTS = [
  new Color('#7dd3fc'),
  new Color('#a3ff6b'),
  new Color('#b78cff'),
  new Color('#ffb545'),
];

function getAccent(biome: number): Color {
  return ACCENTS[biome] ?? ACCENTS[0]!;
}

function getDeckColor(biome: number): Color {
  return DECK_COLORS[biome] ?? DECK_COLORS[0]!;
}

export interface ScatterBuild {
  colors: Float32Array;
  count: number;
  glowColors: Float32Array;
  glowCount: number;
  glowMatrices: Float32Array;
  id: string;
  matrices: Float32Array;
  pillarColors: Float32Array;
  pillarCount: number;
  pillarMatrices: Float32Array;
}

interface EdgeSegment {
  readonly ex: number;
  readonly ey: number;
  readonly sx: number;
  readonly sy: number;
}

interface PartsSink {
  baseZ: number;
  colors: Float32Array;
  count: number;
  glowColors: Float32Array;
  glowCount: number;
  glowMatrices: Float32Array;
  matrices: Float32Array;
  mute: boolean;
  pillarColors: Float32Array;
  pillarCount: number;
  pillarMatrices: Float32Array;
}

const tempMatrix = new Matrix4();
const tempPosition = new Vector3();
const tempQuaternion = new Quaternion();
const tempTilt = new Quaternion();
const tempScale = new Vector3();
const UP = new Vector3(0, 0, 1);
const TILT_AXIS = new Vector3(1, 0, 0);

export function buildScatterForBox(
  userSeed: number,
  viewport: Readonly<Viewport>,
  ground: (x: number, y: number, biome: number) => number,
): ScatterBuild {
  const minCX = viewport.minCX;
  const maxCX = viewport.maxCX;
  const minCY = viewport.minCY;
  const maxCY = viewport.maxCY;

  const sink: PartsSink = {
    baseZ: 0,
    colors: new Float32Array(MAX_PARTS * 3),
    count: 0,
    glowColors: new Float32Array(MAX_GLOW * 3),
    glowCount: 0,
    glowMatrices: new Float32Array(MAX_GLOW * 16),
    matrices: new Float32Array(MAX_PARTS * 16),
    mute: false,
    pillarColors: new Float32Array(MAX_PILLARS * 3),
    pillarCount: 0,
    pillarMatrices: new Float32Array(MAX_PILLARS * 16),
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
      // edge.start/end are node positions already, never cell coordinates
      segments = collectNodeEdges(userSeed, cx, cy).map((edge) => ({
        ex: edge.end[0],
        ey: edge.end[1],
        sx: edge.start[0],
        sy: edge.start[1],
      }));
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
      const cellSample = getBiome(userSeed, cx, cy);
      const biome = cellSample.baseID;

      // the modifier layer's first visual identity: a blacked-out district — every light dead,
      // every surface dimmer, whole patches of the grid gone quiet
      sink.mute = cellSample.modifierID !== 0;

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

        sink.baseZ = ground(x, y, biome);

        if (biome === 1) {
          buildAntennaTree(draw, x, y, sink);
        } else if (biome === 2) {
          buildBuriedWreck(draw, x, y, sink);
        } else {
          buildStack(draw, x, y, biome, sink, isClear);
        }
      }

      const debris = Math.floor(
        cellDraw(7) * (DEBRIS_BASE + (DEBRIS_DENSITY[biome] ?? 4) * cluster),
      );

      for (let d = 0; d < debris; d++) {
        const draw = (salt: number) =>
          buildCoordHashUnit(userSeed, cx, cy, CH + 2000 + d * 20 + salt);
        const [hexX, hexY] = toHexPosition(cx, cy);
        const x = hexX + (draw(0) - 0.5) * 1.7;
        const y = hexY + (draw(1) - 0.5) * 1.7;

        if (!isClear(x, y)) {
          continue;
        }

        sink.baseZ = ground(x, y, biome);

        buildDebris(draw, x, y, biome, sink);
      }

      if (biome === 3 && cellDraw(9) < 0.05) {
        const draw = (salt: number) => buildCoordHashUnit(userSeed, cx, cy, CH + 1500 + salt);
        const [hexX, hexY] = toHexPosition(cx, cy);
        const x = hexX + (draw(0) - 0.5) * 1.2;
        const y = hexY + (draw(1) - 0.5) * 1.2;

        if (isClear(x, y)) {
          sink.baseZ = ground(x, y, biome);

          buildFallenGiant(draw, x, y, sink, isClear);
        }
      }

      if (cellDraw(5) < LANDMARK_CHANCE) {
        const draw = (salt: number) => buildCoordHashUnit(userSeed, cx, cy, CH + 900 + salt);
        const [hexX, hexY] = toHexPosition(cx, cy);
        const x = hexX + (draw(0) - 0.5) * 0.9;
        const y = hexY + (draw(1) - 0.5) * 0.9;

        if (isClear(x, y)) {
          sink.baseZ = ground(x, y, biome);

          buildLandmark(draw, x, y, biome, sink);

          // canon: rare distance-scaled landmarks visible as pillars of light in the fog — the
          // beam grows with distance from origin, an exploration draw on the horizon
          const distance = getHexDistance([cx, cy], ORIGIN_CELL);
          const pillarH = Math.min(2.2 + distance / 30, 8);

          if (sink.pillarCount < MAX_PILLARS) {
            const f = NODE_POSITION_SCALING_FACTOR;
            const accent = getAccent(biome);

            tempPosition.set(x * f, y * f, (sink.baseZ + pillarH / 2) * f);
            tempQuaternion.identity();
            tempScale.set(0.05 * f, 0.05 * f, pillarH * f);
            tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
            tempMatrix.toArray(sink.pillarMatrices, sink.pillarCount * 16);

            sink.pillarColors[sink.pillarCount * 3] = accent.r;
            sink.pillarColors[sink.pillarCount * 3 + 1] = accent.g;
            sink.pillarColors[sink.pillarCount * 3 + 2] = accent.b;

            sink.pillarCount += 1;
          }
        }
      }

      // edge furniture: every biome dresses the roads its cells own, in its own vocabulary
      {
        const owned = collectNodeEdges(userSeed, cx, cy);

        for (const [e, edge] of owned.entries()) {
          // both endpoints derive the same undirected edge; the cell whose node id leads the
          // sorted edge id builds its furniture, so each edge dresses exactly once
          if (!edge.id.startsWith(`${cx}_${cy}|`)) {
            continue;
          }

          const start = edge.start;
          const end = edge.end;
          const edgeDraw = (salt: number) =>
            buildCoordHashUnit(userSeed, cx, cy, CH + 700 + e * 8 + salt);

          sink.baseZ = 0;

          buildEdgeFurniture(edgeDraw, start, end, biome, sink);
          buildViaduct(edgeDraw, start, end, biome, sink);
        }
      }

      // node structure: a deliberate assembly tied to the cell's node, drawn per archetype
      sink.baseZ = 0;

      buildNodeStructure(userSeed, cx, cy, getNode(cx, cy), biome, sink);
    }
  }

  return {
    colors: sink.colors.slice(0, sink.count * 3),
    count: sink.count,
    glowColors: sink.glowColors.slice(0, sink.glowCount * 3),
    glowCount: sink.glowCount,
    glowMatrices: sink.glowMatrices.slice(0, sink.glowCount * 16),
    id: `${userSeed}:${minCX}:${minCY}:${maxCX}:${maxCY}`,
    matrices: sink.matrices.slice(0, sink.count * 16),
    pillarColors: sink.pillarColors.slice(0, sink.pillarCount * 3),
    pillarCount: sink.pillarCount,
    pillarMatrices: sink.pillarMatrices.slice(0, sink.pillarCount * 16),
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

  tempPosition.set(x * f, y * f, (z + sink.baseZ) * f);
  tempQuaternion.setFromAxisAngle(UP, spin);

  if (tilt !== 0) {
    tempTilt.setFromAxisAngle(TILT_AXIS, tilt);
    tempQuaternion.multiply(tempTilt);
  }

  tempScale.set(w * f, d * f, h * f);
  tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
  tempMatrix.toArray(sink.matrices, sink.count * 16);

  const dim = sink.mute ? 0.32 : 1;

  sink.colors[sink.count * 3] = color.r * shade * dim;
  sink.colors[sink.count * 3 + 1] = color.g * shade * dim;
  sink.colors[sink.count * 3 + 2] = color.b * shade * dim;

  sink.count += 1;
}

function pushGlow(
  sink: PartsSink,
  x: number,
  y: number,
  z: number,
  size: number,
  accent: Readonly<Color>,
): void {
  if (sink.glowCount >= MAX_GLOW || sink.mute) {
    return;
  }

  const f = NODE_POSITION_SCALING_FACTOR;

  tempPosition.set(x * f, y * f, (z + sink.baseZ) * f);
  tempQuaternion.identity();
  tempScale.set(size * f, size * f, size * f);
  tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
  tempMatrix.toArray(sink.glowMatrices, sink.glowCount * 16);

  sink.glowColors[sink.glowCount * 3] = accent.r;
  sink.glowColors[sink.glowCount * 3 + 1] = accent.g;
  sink.glowColors[sink.glowCount * 3 + 2] = accent.b;

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

      pushPart(sink, px, py, w / 2, w, w, h, spin, Math.PI / 2, base, 0.55 + draw(30 + s) * 0.55);
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
      0.6 + draw(30 + s) * 0.75,
    );

    z += h;
  }
}

/**
 * Grown Works machine-tree: a tapered mast carrying symmetric crossbars that rotate tier by tier —
 * power-pole bones, antenna soul. A rare tip light marks the tallest.
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

  pushPart(sink, x, y, height * 0.3, mastW, mastW, height * 0.6, 0, 0, base, 0.7 + draw(4) * 0.4);
  pushPart(
    sink,
    x,
    y,
    height * 0.6 + height * 0.2,
    mastW * 0.65,
    mastW * 0.65,
    height * 0.4,
    0,
    0,
    base,
    0.8 + draw(5) * 0.35,
  );

  const tiers = 2 + Math.floor(draw(6) * 2);
  const baseAngle = draw(7) * Math.PI;

  for (let t = 0; t < tiers; t++) {
    const tierZ = height * (0.5 + 0.42 * (t / Math.max(1, tiers - 1)));
    const angle = baseAngle + t * 1.1;
    const span = (0.34 + draw(10 + t) * 0.2) * PROP_SCALE * (1 - t * 0.18);
    const armW = mastW * 0.55;

    // one box through the mast — a symmetric crossbar, not a floating arm
    pushPart(sink, x, y, tierZ, span, armW, armW, angle, 0, base, 0.75 + draw(20 + t) * 0.35);
  }

  if (draw(50) > 0.65 && height > 1 * PROP_SCALE) {
    pushGlow(sink, x, y, height + 0.02, 0.028 * PROP_SCALE * 2, getAccent(1));
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

  // every node is a site: a modest foundation pad under the disc, so destinations read as places
  pushPart(sink, x, y, 0.006, 0.3, 0.3, 0.012, draw(90) * Math.PI, 0, base, 0.55);

  // compound buildings ring most sites — the settlement the node represents
  if (archetype > 0.2) {
    const buildings = 1 + Math.floor(draw(91) * 3);

    for (let b = 0; b < buildings; b++) {
      const angle = draw(92 + b) * Math.PI * 2;
      const radius = 0.34 + draw(95 + b) * 0.14;
      const w = 0.07 + draw(98 + b) * 0.08;
      const h = 0.05 + draw(101 + b) * 0.12;

      pushPart(
        sink,
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius,
        h / 2,
        w,
        w * (0.8 + draw(104 + b) * 0.6),
        h,
        angle,
        0,
        base,
        0.75 + draw(107 + b) * 0.3,
      );
    }
  }

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
      if (draw(30) > 0.5) {
        pushGlow(sink, x + Math.cos(angle + side) * radius, y + Math.sin(angle + side) * radius, h + 0.03, 0.032 * NODE_STRUCT_SCALE, getAccent(biome));
      }
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

  pushGlow(sink, sx, sy, z + 0.04, 0.05 * NODE_STRUCT_SCALE, getAccent(biome));
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
  pushGlow(sink, x, y, z + mastH + 0.05, 0.065 * PROP_SCALE, getAccent(biome));
}

/**
 * Ground-layer filler: low plating shards, rubble chips, and stub blocks. High count, tiny
 * silhouette — it textures the floor without competing with structures.
 */
function buildDebris(
  draw: (salt: number) => number,
  x: number,
  y: number,
  biome: number,
  sink: PartsSink,
): void {
  const base = PALETTE[biome] ?? PALETTE[0]!;
  const kind = draw(2);

  if (kind < 0.5) {
    // flat plating shard
    const w = (0.06 + draw(3) * 0.12) * PROP_SCALE * 2;
    const d = (0.06 + draw(4) * 0.12) * PROP_SCALE * 2;
    const h = 0.015 + draw(5) * 0.02;

    pushPart(sink, x, y, h / 2, w, d, h, draw(6) * Math.PI, 0, base, 0.45 + draw(7) * 0.6);

    return;
  }

  if (kind < 0.85) {
    // rubble chip
    const w = (0.03 + draw(3) * 0.06) * PROP_SCALE * 2;
    const h = w * (0.6 + draw(5) * 0.8);

    pushPart(sink, x, y, h / 2, w, w, h, draw(6) * Math.PI, (draw(8) - 0.5) * 0.6, base, 0.4 + draw(7) * 0.65);

    return;
  }

  // stub block — a structure that barely started or barely remains
  const w = (0.08 + draw(3) * 0.1) * PROP_SCALE;
  const h = (0.08 + draw(5) * 0.15) * PROP_SCALE;

  pushPart(sink, x, y, h / 2, w, w, h, draw(6) * Math.PI, 0, base, 0.55 + draw(7) * 0.55);
}

/**
 * The Quiet's whisper: a single hull slab pitched into the ground, mostly buried — evidence
 * something came down here long ago.
 */
function buildBuriedWreck(
  draw: (salt: number) => number,
  x: number,
  y: number,
  sink: PartsSink,
): void {
  const base = PALETTE[2]!;
  const w = (0.25 + draw(3) * 0.35) * PROP_SCALE;
  const l = w * (1.6 + draw(4) * 1.2);
  const t = w * 0.22;
  const pitch = 0.5 + draw(5) * 0.5;

  // sink it: center below grade so only a corner shoulder emerges
  pushPart(sink, x, y, -l * 0.18, w, l, t, draw(6) * Math.PI, pitch, base, 0.5 + draw(7) * 0.2);

  if (draw(8) > 0.6) {
    // a snapped fragment beside the hull
    pushPart(
      sink,
      x + (draw(9) - 0.5) * 0.4,
      y + (draw(10) - 0.5) * 0.4,
      0.015,
      w * 0.4,
      w * 0.5,
      0.03,
      draw(11) * Math.PI,
      0,
      base,
      0.45,
    );
  }
}

/**
 * Ruinfall's drama piece: a collapsed superstructure — an arc of massive tilted slabs falling in
 * one direction, each clearance-checked so the giant breaks around roads.
 */
function buildFallenGiant(
  draw: (salt: number) => number,
  x: number,
  y: number,
  sink: PartsSink,
  isClear: (x: number, y: number) => boolean,
): void {
  const base = PALETTE[3]!;
  const heading = draw(2) * Math.PI * 2;
  const slabs = 3 + Math.floor(draw(3) * 3);
  const slabW = (0.35 + draw(4) * 0.25) * PROP_SCALE * 1.8;
  const step = slabW * 1.15;

  for (let i = 0; i < slabs; i++) {
    const along = i * step;
    const px = x + Math.cos(heading) * along;
    const py = y + Math.sin(heading) * along;

    if (!isClear(px, py)) {
      break;
    }

    // slabs fall progressively flatter along the arc, sinking deeper as they flatten
    const fall = i / Math.max(1, slabs - 1);
    const tilt = 0.25 + fall * 1.2;
    const h = slabW * (2.2 - fall * 1.4);

    pushPart(
      sink,
      px,
      py,
      h * 0.32 * (1 - fall * 0.7),
      slabW,
      slabW * 0.5,
      h,
      heading + (draw(10 + i) - 0.5) * 0.3,
      tilt,
      base,
      0.7 + draw(20 + i) * 0.25,
    );
  }
}

/**
 * Structures living along a road, in the owning biome's vocabulary: lit lamp pairs on maintained
 * routes, gate remnants in the ruins, leaning tap-masts in the grown works, rare waymarkers in the
 * quiet. Offsets sit just outside the road corridor, so the route stays walkable.
 */
function buildEdgeFurniture(
  draw: (salt: number) => number,
  start: readonly [number, number],
  end: readonly [number, number],
  biome: number,
  sink: PartsSink,
): void {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const len = Math.hypot(dx, dy);
  const px = -dy / len;
  const py = dx / len;
  const base = PALETTE[biome] ?? PALETTE[0]!;
  const accent = getAccent(biome);

  if (biome === 0) {
    // maintained: paired lamps, both verges, still lit
    const side = draw(0) > 0.5 ? 1 : -1;

    for (const t of [0.3, 0.7]) {
      const lx = start[0] + dx * t + px * 0.24 * side;
      const ly = start[1] + dy * t + py * 0.24 * side;
      const h = 0.22;

      pushPart(sink, lx, ly, h / 2, 0.018, 0.018, h, 0, 0, base, 1);
      pushGlow(sink, lx, ly, h + 0.015, 0.03, accent);
    }

    return;
  }

  if (biome === 3 && draw(1) < 0.4) {
    // ruin: a gate that lost its lintel — one post standing, one stump, the beam in the verge
    const t = 0.35 + draw(2) * 0.3;
    const gx = start[0] + dx * t;
    const gy = start[1] + dy * t;
    const standH = 0.28 + draw(3) * 0.12;

    pushPart(sink, gx + px * 0.22, gy + py * 0.22, standH / 2, 0.03, 0.03, standH, 0, 0, base, 0.9);
    pushPart(sink, gx - px * 0.22, gy - py * 0.22, 0.05, 0.035, 0.035, 0.1, 0, 0, base, 0.7);
    pushPart(
      sink,
      gx - px * 0.34,
      gy - py * 0.34,
      0.02,
      0.04,
      0.34,
      0.04,
      Math.atan2(dy, dx) + (draw(4) - 0.5) * 0.6,
      Math.PI / 2,
      base,
      0.6,
    );

    if (draw(5) > 0.75) {
      pushGlow(sink, gx + px * 0.22, gy + py * 0.22, standH + 0.02, 0.02, accent);
    }

    return;
  }

  if (biome === 1 && draw(1) < 0.35) {
    // grown works: a tap — two thin masts leaning in over the route from opposite verges
    const t = 0.4 + draw(2) * 0.2;
    const gx = start[0] + dx * t;
    const gy = start[1] + dy * t;

    for (const side of [1, -1]) {
      const h = 0.3 + draw(side > 0 ? 3 : 4) * 0.15;

      pushPart(
        sink,
        gx + px * 0.26 * side,
        gy + py * 0.26 * side,
        h / 2,
        0.014,
        0.014,
        h,
        Math.atan2(py, px),
        -side * 0.35,
        base,
        0.85,
      );
      pushGlow(sink, gx + px * 0.18 * side, gy + py * 0.18 * side, h * 0.92, 0.02, accent);
    }

    return;
  }

  if (biome === 2 && draw(1) < 0.15) {
    // quiet: a lone dim waymarker
    const t = 0.3 + draw(2) * 0.4;
    const h = 0.14;
    const gx = start[0] + dx * t + px * 0.22;
    const gy = start[1] + dy * t + py * 0.22;

    pushPart(sink, gx, gy, h / 2, 0.02, 0.02, h, 0, 0, base, 0.8);
    pushGlow(sink, gx, gy, h + 0.012, 0.018, accent);
  }
}

/** deck height above grade — an elevated transit spine, not paint on the ground */
const DECK_Z = 0.07;
const DECK_WIDTH = 0.2;
const DECK_THICKNESS = 0.03;
const DECK_SEGMENT = 0.3;

/** deck plating per biome: the biome palette pulled partway toward pale concrete, so routes
 * belong to the terrain they cross while still reading as built infrastructure */
const DECK_COLORS = PALETTE.map((base) => base.clone().lerp(new Color('#9aa3b8'), 0.35));

/**
 * The physical travel path under the navigation line: an elevated viaduct of deck segments on
 * piers. Maintained routes run intact; ruin routes lose segments — the gap-toothed freeway, its
 * fallen span lying below; the quiet has no built path at all, only the line.
 */
function buildViaduct(
  draw: (salt: number) => number,
  start: readonly [number, number],
  end: readonly [number, number],
  biome: number,
  sink: PartsSink,
): void {
  if (biome === 2) {
    return;
  }

  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const len = Math.hypot(dx, dy);
  const spin = Math.atan2(dy, dx);
  const base = PALETTE[biome] ?? PALETTE[0]!;
  const margin = 0.3;
  const usable = len - margin * 2;
  const segments = Math.max(2, Math.round(usable / DECK_SEGMENT));
  const step = usable / segments;
  const gapChance = biome === 3 ? 0.12 : 0;

  // per-edge build variation: routes differ in gauge and elevation, each route consistent
  const deckW = DECK_WIDTH * (0.7 + draw(90) * 0.34);
  const deckZ = DECK_Z * (0.65 + draw(91) * 0.7);
  const deckT = DECK_THICKNESS * (0.8 + draw(92) * 0.5);

  // one continuous ribbon per run: the near-top-down camera erases elevation cues, so a road
  // must read as an unbroken band — ruin gaps split the ribbon into separate runs
  let runStart = 0;

  for (let k = 0; k <= segments; k++) {
    const gap = k === segments || draw(100 + k) < gapChance;

    if (!gap) {
      continue;
    }

    if (k > runStart) {
      const t0 = (margin + step * runStart) / len;
      const t1 = (margin + step * k) / len;
      const cx = start[0] + dx * (t0 + t1) / 2;
      const cy = start[1] + dy * (t0 + t1) / 2;
      const runLen = (t1 - t0) * len;

      pushPart(sink, cx, cy, deckZ, runLen, deckW, deckT, spin, 0, getDeckColor(biome), 1);
    }

    if (k < segments && draw(140 + k) > 0.4) {
      // the fallen span lies skewed beside the break
      const t = (margin + step * (k + 0.5)) / len;

      pushPart(
        sink,
        start[0] + dx * t + (draw(160 + k) - 0.5) * 0.24,
        start[1] + dy * t + (draw(180 + k) - 0.5) * 0.24,
        deckT,
        step * 1.02,
        deckW,
        deckT,
        spin + (draw(200 + k) - 0.5) * 1.2,
        0,
        base,
        0.5,
      );
    }

    runStart = k + 1;
  }
}
