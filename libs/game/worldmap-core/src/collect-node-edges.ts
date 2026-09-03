import { buildCellNode } from './build-cell-node';
import { EDGE_DISTANCE_CAP } from './consts';
import type { WorldEdge, WorldMapNode } from './types';

const WITNESS_RING_RADIUS = 2;

export function collectNodeEdges(userSeed: number, cx: number, cy: number): Array<WorldEdge> {
  const source = buildCellNode(userSeed, cx, cy);
  const pool = collectDiscNodes(userSeed, cx, cy, WITNESS_RING_RADIUS);
  const capSquared = EDGE_DISTANCE_CAP * EDGE_DISTANCE_CAP;
  const edges: Array<WorldEdge> = [];

  for (const candidate of pool) {
    if (candidate.id === source.id) {
      continue;
    }

    if (getDistanceSquared(source.position, candidate.position) > capSquared) {
      continue;
    }

    if (hasWitnessInside(source, candidate, pool)) {
      continue;
    }

    edges.push(buildEdge(source, candidate));
  }

  return edges;
}

function collectDiscNodes(
  userSeed: number,
  cx: number,
  cy: number,
  radius: number,
): Array<WorldMapNode> {
  const nodes: Array<WorldMapNode> = [];

  for (let dq = -radius; dq <= radius; dq++) {
    const lowDr = Math.max(-radius, -dq - radius);
    const highDr = Math.min(radius, -dq + radius);

    for (let dr = lowDr; dr <= highDr; dr++) {
      nodes.push(buildCellNode(userSeed, cx + dq, cy + dr));
    }
  }

  return nodes;
}

function hasWitnessInside(
  a: WorldMapNode,
  b: WorldMapNode,
  pool: ReadonlyArray<WorldMapNode>,
): boolean {
  const midX = (a.position[0] + b.position[0]) / 2;
  const midY = (a.position[1] + b.position[1]) / 2;
  const radiusSquared = getDistanceSquared(a.position, b.position) / 4;

  return pool.some((witness) => {
    if (witness.id === a.id || witness.id === b.id) {
      return false;
    }

    return getDistanceSquared([midX, midY], witness.position) < radiusSquared;
  });
}

function buildEdge(a: WorldMapNode, b: WorldMapNode): WorldEdge {
  const id = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;

  return { endPosition: b.position, id, startPosition: a.position };
}

function getDistanceSquared(a: readonly [number, number], b: readonly [number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];

  return dx * dx + dy * dy;
}
