import { CHUNK_SIZE, buildChunk, collectNodeEdges } from '@vers/worldmap-core';
import type { Viewport, WorldEdge, WorldMapNode } from '@vers/worldmap-core';
import type { WorldGraph } from './types';

/**
 * Assembles every cell the viewport bounds as a node, its edges, and no more: an edge to a cell
 * outside the viewport is dropped, so every rendered edge lands on a rendered node. Node generation
 * is memoized chunk-wise per seed, so panning back over an already-visited chunk costs no fresh
 * hashing.
 */
export function buildViewportGraph(userSeed: number, viewport: Viewport): WorldGraph {
  const nodes: Record<string, WorldMapNode> = {};
  const minChunkX = Math.floor(viewport.minCX / CHUNK_SIZE);
  const maxChunkX = Math.floor(viewport.maxCX / CHUNK_SIZE);
  const minChunkY = Math.floor(viewport.minCY / CHUNK_SIZE);
  const maxChunkY = Math.floor(viewport.maxCY / CHUNK_SIZE);

  for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
    for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
      for (const node of getChunkNodes(userSeed, chunkX, chunkY)) {
        const [cx, cy] = node.coord;

        if (
          cx >= viewport.minCX &&
          cx <= viewport.maxCX &&
          cy >= viewport.minCY &&
          cy <= viewport.maxCY
        ) {
          nodes[node.id] = node;
        }
      }
    }
  }

  const edges: Record<string, WorldEdge> = {};

  for (const node of Object.values(nodes)) {
    for (const edge of collectNodeEdges(userSeed, node.coord[0], node.coord[1])) {
      const [aID = '', bID = ''] = edge.id.split('|');

      if (nodes[aID] && nodes[bID]) {
        edges[edge.id] = edge;
      }
    }
  }

  return { edges, nodes };
}

const chunkCache = new Map<string, ReadonlyArray<WorldMapNode>>();

/**
 * A chunk's nodes, generated once per seed and coordinate and reused on every later call — chunk
 * generation is a pure function of `userSeed`, `chunkX`, and `chunkY`, so caching it never returns
 * stale data.
 */
function getChunkNodes(
  userSeed: number,
  chunkX: number,
  chunkY: number,
): ReadonlyArray<WorldMapNode> {
  const key = `${userSeed}:${chunkX}:${chunkY}`;
  const cached = chunkCache.get(key);

  if (cached) {
    return cached;
  }

  const chunk = buildChunk(userSeed, chunkX, chunkY);

  chunkCache.set(key, chunk);

  return chunk;
}
