import type { WorldEdge, WorldMapNode } from '@vers/worldmap-core';

export type VectorTuple = [number, number, number];

/**
 * A rendered region of the lattice: nodes and edges keyed by id. Assembled from the generator for a
 * bounded area around a center, so the client holds a finite slice of the infinite map.
 */
export interface WorldGraph {
  readonly edges: Readonly<Record<string, WorldEdge>>;
  readonly nodes: Readonly<Record<string, WorldMapNode>>;
}
