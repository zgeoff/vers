export type CanonicalID = string;

export interface WorldMapNode {
  readonly coord: readonly [number, number];
  readonly difficulty: number;
  readonly id: CanonicalID;
  readonly position: readonly [number, number];
}

export interface WorldEdge {
  readonly endPosition: readonly [number, number];
  readonly id: string;
  readonly startPosition: readonly [number, number];
}

export interface RevealSource {
  readonly coord: readonly [number, number];
  readonly radius: number;
}

export interface Viewport {
  readonly maxCX: number;
  readonly maxCY: number;
  readonly minCX: number;
  readonly minCY: number;
}

export type RevealedCells = ReadonlyArray<number>;

export interface ReadonlyFloatArray {
  readonly length: number;
  readonly [index: number]: number;
}

export interface RevealDistanceField {
  readonly cols: number;
  readonly rows: number;
  readonly values: ReadonlyFloatArray;
}

export interface ReadonlyUint8Array {
  readonly length: number;
  readonly [index: number]: number;
}

export interface BiomeRosterEntry {
  readonly id: number;
  readonly name: string;
  readonly weights: ReadonlyArray<readonly [distance: number, weight: number]>;
}

export interface BiomeSample {
  readonly baseID: number;
  readonly blendT: number;
  readonly modifierID: number;
  readonly neighbourBaseID: number;
}

export interface BiomeField {
  readonly baseIDs: ReadonlyUint8Array;
  readonly blendTs: ReadonlyFloatArray;
  readonly cols: number;
  readonly modifierIDs: ReadonlyUint8Array;
  readonly neighbourBaseIDs: ReadonlyUint8Array;
  readonly rows: number;
}
