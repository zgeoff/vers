import { CHUNK_SIZE, buildChunk, collectNodeEdges } from '@vers/worldmap-core';
import type { Viewport, WorldEdge, WorldMapNode } from '@vers/worldmap-core';
import type { WorldGraph } from './types';
import { LRUMap } from './utils/lru-map';

/**
 * Assembles every cell the viewport bounds as a node, its edges, and no more: an edge to a cell
 * outside the viewport is dropped, so every rendered edge lands on a rendered node. Node and edge
 * generation is memoized chunk-wise per seed in a bounded cache, so panning back over a
 * recently-visited chunk costs no fresh hashing.
 */
export function buildViewportGraph(userSeed: number, viewport: Viewport): WorldGraph {
  const nodes: Record<string, WorldMapNode> = {};
  const chunks: Array<WorldChunk> = [];
  const minChunkX = Math.floor(viewport.minCX / CHUNK_SIZE);
  const maxChunkX = Math.floor(viewport.maxCX / CHUNK_SIZE);
  const minChunkY = Math.floor(viewport.minCY / CHUNK_SIZE);
  const maxChunkY = Math.floor(viewport.maxCY / CHUNK_SIZE);

  for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
    for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
      const chunk = getChunk(userSeed, chunkX, chunkY);

      chunks.push(chunk);

      for (const node of chunk.nodes) {
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

  for (const chunk of chunks) {
    for (const edge of chunk.edges) {
      const [aID = '', bID = ''] = edge.id.split('|');

      if (nodes[aID] && nodes[bID]) {
        edges[edge.id] = edge;
      }
    }
  }

  return { edges, nodes };
}

interface WorldChunk {
  readonly edges: ReadonlyArray<WorldEdge>;
  readonly nodes: ReadonlyArray<WorldMapNode>;
}

/**
 * Retained-chunk bound: enough for several max-zoom screens of recently visited world, small enough
 * that a long free pan never grows the tab's memory without bound.
 */
const CHUNK_CACHE_CAPACITY = 256;

const chunkCache = new LRUMap<string, WorldChunk>(CHUNK_CACHE_CAPACITY);

/**
 * A chunk's nodes and edges, generated once per seed and coordinate and reused while the entry
 * survives the cache's least-recently-used bound — chunk generation is a pure function of
 * `userSeed`, `chunkX`, and `chunkY`, so caching it never returns stale data. Edges are every edge
 * incident to a chunk node, deduplicated on id; callers drop the ones whose far endpoint they don't
 * render.
 */
function getChunk(userSeed: number, chunkX: number, chunkY: number): WorldChunk {
  const key = `${userSeed}:${chunkX}:${chunkY}`;
  const cached = chunkCache.get(key);

  if (cached) {
    return cached;
  }

  const nodes = buildChunk(userSeed, chunkX, chunkY);
  const edges: Array<WorldEdge> = [];

  const seenEdgeIDs = new Set<string>();

  for (const node of nodes) {
    for (const edge of collectNodeEdges(userSeed, node.coord[0], node.coord[1])) {
      if (!seenEdgeIDs.has(edge.id)) {
        seenEdgeIDs.add(edge.id);
        edges.push(edge);
      }
    }
  }

  const chunk: WorldChunk = { edges, nodes };

  chunkCache.set(key, chunk);

  return chunk;
}
