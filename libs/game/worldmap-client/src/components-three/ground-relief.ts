/**
 * SPIKE: shared terrain-height sampler — low-frequency swells, biome-tuned amplitude, graded flat
 * along road corridors and around nodes so the lattice always sits on level ground.
 */
import type { WorldMapNode } from '@vers/worldmap-core';
import { buildCellNode, buildValueNoise, collectNodeEdges } from '@vers/worldmap-core';

/** height-noise channels, clear of the scatter block */
const CH_COARSE = 3000;
const CH_FINE = 3001;

/** swell amplitude per base biome, hex units — the quiet rolls, the maintained is engineered flat */
const RELIEF_AMP = [0.06, 0.14, 0.4, 0.2];

/** scene-space distance over which terrain ramps from road-level to full relief */
const GRADE_RAMP = 0.9;

/** road corridor half-width held dead flat */
const GRADE_FLAT = 0.3;

export type GroundHeightSampler = (x: number, y: number, biome: number) => number;

/**
 * Factory over per-seed caches: node positions and edge segments memoize per cell, so dense
 * sampling (ground vertices, scatter props) stays cheap.
 */
export function makeGroundHeightSampler(userSeed: number): GroundHeightSampler {
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

  interface Segment {
    readonly ex: number;
    readonly ey: number;
    readonly sx: number;
    readonly sy: number;
  }

  const edges = new Map<string, ReadonlyArray<Segment>>();

  const getEdges = (cx: number, cy: number): ReadonlyArray<Segment> => {
    const key = `${cx}_${cy}`;
    let segments = edges.get(key);

    if (segments === undefined) {
      segments = collectNodeEdges(userSeed, cx, cy).map((edge) => {
        const start = getNode(edge.start[0], edge.start[1]).position;
        const end = getNode(edge.end[0], edge.end[1]).position;

        return { ex: end[0], ey: end[1], sx: start[0], sy: start[1] };
      });
      edges.set(key, segments);
    }

    return segments;
  };

  return (x: number, y: number, biome: number): number => {
    const amp = RELIEF_AMP[biome] ?? 0.15;

    if (amp === 0) {
      return 0;
    }

    // nearest lattice feature distance, scanning the 3x3 cell box
    const axialY = y / 1.5;
    const axialX = x / 1.7320508 - axialY / 2;
    let nearestSq = Number.POSITIVE_INFINITY;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cellX = Math.round(axialX) + dx;
        const cellY = Math.round(axialY) + dy;
        const node = getNode(cellX, cellY);
        const nx = x - node.position[0];
        const ny = y - node.position[1];
        const nodeSq = nx * nx + ny * ny;

        if (nodeSq < nearestSq) {
          nearestSq = nodeSq;
        }

        for (const s of getEdges(cellX, cellY)) {
          const ex = s.ex - s.sx;
          const ey = s.ey - s.sy;
          const lengthSq = ex * ex + ey * ey;
          const t =
            lengthSq === 0
              ? 0
              : Math.max(0, Math.min(1, ((x - s.sx) * ex + (y - s.sy) * ey) / lengthSq));
          const px = s.sx + t * ex - x;
          const py = s.sy + t * ey - y;
          const segSq = px * px + py * py;

          if (segSq < nearestSq) {
            nearestSq = segSq;
          }
        }
      }
    }

    const distance = Math.sqrt(nearestSq);
    const grade = Math.max(0, Math.min(1, (distance - GRADE_FLAT) / GRADE_RAMP));

    if (grade === 0) {
      return 0;
    }

    const eased = grade * grade * (3 - 2 * grade);
    const coarse = buildValueNoise(userSeed, x * 0.09, y * 0.09, CH_COARSE) - 0.5;
    const fine = buildValueNoise(userSeed, x * 0.27, y * 0.27, CH_FINE) - 0.5;
    const swell = coarse * 0.75 + fine * 0.25;

    return swell * amp * eased;
  };
}
