import type { WorldEdge, WorldMapNode } from '@vers/worldmap-core';

export type VectorTuple = [number, number, number];

export interface WorldGraph {
  readonly edges: Readonly<Record<string, WorldEdge>>;
  readonly nodes: Readonly<Record<string, WorldMapNode>>;
}

export interface ScatterBuildStats {
  buildMs: number;
  glowCount: number;
  partCount: number;
}

export interface PerfStats {
  readonly drawCalls: number;
  readonly fps: number;
  readonly scatterBuildMs: number;
  readonly scatterGlowCount: number;
  readonly scatterPartCount: number;
  readonly triangleCount: number;
  readonly worstFrameMs: number;
}
