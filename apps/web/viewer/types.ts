/** Shared types for the viewer's data-driven scene: everything the placements file describes. */

/** Which side of a block carries windows, in its local frame before yaw. */
export type BlockFacing = 'nx' | 'px' | 'pz';

export type BlockRole = 'back' | 'filler' | 'fore';

/** A background massing block: a plain box silhouette, part of the fog-shrouded skyline. */
export interface BlockPlacement {
  readonly d: number;
  readonly facing: BlockFacing;
  readonly h: number;
  readonly mast: boolean;
  readonly role: BlockRole;
  ry: number;
  readonly w: number;
  x: number;
  z: number;
}

/**
 * An authored-asset slot. `file` names a .glb the side server carries; while null, the slot
 * renders as a placeholder box of `size` so the composition and hover menu stay testable.
 */
export interface ModelPlacement {
  readonly file: string | null;
  readonly key: string;
  readonly nav: boolean;
  ry: number;
  readonly scale: number;
  readonly size?: readonly [number, number, number];
  x: number;
  z: number;
}

export interface PlacementsFile {
  readonly blocks: Array<BlockPlacement>;
  readonly models: Array<ModelPlacement>;
}
