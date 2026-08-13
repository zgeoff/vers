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

/**
 * The scatter build pipeline's latest telemetry: how many instanced parts and glow instances its
 * most recent chunk rebuild produced, and how long that rebuild took. The pipeline owns writing
 * these fields directly; the perf HUD only reads them.
 */
export interface ScatterBuildStats {
  buildMs: number;
  glowCount: number;
  partCount: number;
}

/**
 * A rolling snapshot of frame timing and scatter build telemetry, refreshed roughly twice a second
 * by the perf HUD's frame probe for display in the dev tools panel.
 */
export interface PerfStats {
  readonly drawCalls: number;
  readonly fps: number;
  readonly scatterBuildMs: number;
  readonly scatterGlowCount: number;
  readonly scatterPartCount: number;
  readonly triangleCount: number;
  readonly worstFrameMs: number;
}
