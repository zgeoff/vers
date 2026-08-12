import { canEncodeMortonKey } from './can-encode-morton-key';
import { HEX_SIZE } from './consts';
import { decodeMortonKey } from './decode-morton-key';
import { encodeMortonKey } from './encode-morton-key';
import { toHexPosition } from './to-hex-position';
import type { FrontierEdge, RevealedCells, Viewport } from './types';

const SQRT_3 = Math.sqrt(3);
const CORNER_NE: readonly [number, number] = [(HEX_SIZE * SQRT_3) / 2, HEX_SIZE / 2];
const CORNER_N: readonly [number, number] = [0, HEX_SIZE];
const CORNER_NW: readonly [number, number] = [(-HEX_SIZE * SQRT_3) / 2, HEX_SIZE / 2];
const CORNER_SW: readonly [number, number] = [(-HEX_SIZE * SQRT_3) / 2, -HEX_SIZE / 2];
const CORNER_S: readonly [number, number] = [0, -HEX_SIZE];
const CORNER_SE: readonly [number, number] = [(HEX_SIZE * SQRT_3) / 2, -HEX_SIZE / 2];

interface NeighbourSide {
  readonly a: readonly [number, number];
  readonly b: readonly [number, number];
  readonly dcx: number;
  readonly dcy: number;
}

/**
 * The six axial neighbour directions, each paired with the corner offsets bounding the hex side
 * shared with that neighbour.
 */
const NEIGHBOUR_SIDES: ReadonlyArray<NeighbourSide> = [
  { a: CORNER_SE, b: CORNER_NE, dcx: 1, dcy: 0 },
  { a: CORNER_NE, b: CORNER_N, dcx: 0, dcy: 1 },
  { a: CORNER_N, b: CORNER_NW, dcx: -1, dcy: 1 },
  { a: CORNER_NW, b: CORNER_SW, dcx: -1, dcy: 0 },
  { a: CORNER_SW, b: CORNER_S, dcx: 0, dcy: -1 },
  { a: CORNER_S, b: CORNER_SE, dcx: 1, dcy: -1 },
];

/**
 * Traces the reveal frontier: for every revealed cell inside the viewport, the hex sides shared
 * with an unrevealed neighbour, as scene-space segments in unit-hex coordinates.
 *
 * Neighbour membership is read from the whole revealed set, including cells outside the viewport —
 * callers must compute `revealedCells` over the viewport inflated by at least one cell, or a
 * revealed neighbour missing from a tightly clipped set reads as unrevealed and a false frontier
 * appears at the viewport edge.
 *
 * A neighbour outside the packable coordinate range is genuinely unrevealed: the world ends there,
 * and the frontier closes along that side.
 */
export function collectFrontierEdges(
  revealedCells: RevealedCells,
  viewport: Readonly<Viewport>,
): ReadonlyArray<FrontierEdge> {
  const revealed = new Set(revealedCells);

  const edges: Array<FrontierEdge> = [];

  for (const key of revealedCells) {
    const [cx, cy] = decodeMortonKey(key);

    if (cx < viewport.minCX || cx > viewport.maxCX || cy < viewport.minCY || cy > viewport.maxCY) {
      continue;
    }

    const [x, y] = toHexPosition(cx, cy);

    for (const side of NEIGHBOUR_SIDES) {
      const neighbour: readonly [number, number] = [cx + side.dcx, cy + side.dcy];

      if (canEncodeMortonKey(neighbour) && revealed.has(encodeMortonKey(neighbour))) {
        continue;
      }

      edges.push([
        [x + side.a[0], y + side.a[1]],
        [x + side.b[0], y + side.b[1]],
      ]);
    }
  }

  return edges;
}
