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

function getDistanceSquared(
  left: readonly [number, number],
  right: readonly [number, number],
): number {
  const dx = left[0] - right[0];
  const dy = left[1] - right[1];

  return dx * dx + dy * dy;
}

function hasWitnessInside(
  left: WorldMapNode,
  right: WorldMapNode,
  pool: ReadonlyArray<WorldMapNode>,
): boolean {
  const midX = (left.position[0] + right.position[0]) / 2;
  const midY = (left.position[1] + right.position[1]) / 2;
  const radiusSquared = getDistanceSquared(left.position, right.position) / 4;

  return pool.some((witness) => {
    if (witness.id === left.id || witness.id === right.id) {
      return false;
    }

    return getDistanceSquared([midX, midY], witness.position) < radiusSquared;
  });
}

function buildEdge(left: WorldMapNode, right: WorldMapNode): WorldEdge {
  const id = left.id < right.id ? `${left.id}|${right.id}` : `${right.id}|${left.id}`;

  return { endPosition: right.position, id, startPosition: left.position };
}
