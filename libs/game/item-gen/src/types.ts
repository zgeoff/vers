export interface WeightedEntry<T> {
  readonly value: T;
  readonly weight: number;
}

/**
 * A deterministic sequence of typed draws expanded from a single digest: equal inputs produce
 * identical draws, and a draw's byte consumption is part of the frozen contract — a degenerate
 * range (`min === max`) consumes no bytes.
 */
export interface RollStream {
  readonly pickWeighted: <T>(entries: ReadonlyArray<WeightedEntry<T>>) => T;
  readonly rollRange: (min: number, max: number) => number;
}

export interface RewardCoordinate {
  readonly avatarID: string;
  readonly nodeID: string;
  readonly chainIndex: number;
  readonly ordinal: number;
}

export interface CraftPosition {
  readonly avatarID: string;
  readonly position: number;
}

/**
 * The `kind` discriminant is folded into the position's byte encoding, so a craft position and a
 * reward coordinate can never share a digest.
 */
export type RollPosition =
  | (CraftPosition & { readonly kind: 'craft' })
  | (RewardCoordinate & { readonly kind: 'reward' });

/**
 * Replay-verified trajectory facts that select which tables a stream is read against — never
 * outcomes. A field that scales a market-grade quantity is a published scalar, never rolled.
 */
export interface SlotContext {
  readonly nodeTier: number;
}

export interface RarityDef {
  readonly id: string;
  readonly weight: number;
  readonly affixCountMin: number;
  readonly affixCountMax: number;
}

export interface BaseDef {
  readonly id: string;
  readonly weight: number;
}

/**
 * At most one affix per `groupID` lands in a single roll — group exclusivity is unconditional.
 */
export interface AffixDef {
  readonly id: string;
  readonly groupID: string;
  readonly weight: number;
  readonly valueMin: number;
  readonly valueMax: number;
}

export interface AffixTables {
  readonly affixes: ReadonlyArray<AffixDef>;
}

/**
 * A content version pins table data and interpreter draw sequence together: any change to either
 * is a new version, and every shipped version stays loadable.
 */
export interface LootTables extends AffixTables {
  readonly contentVersion: string;
  readonly rarities: ReadonlyArray<RarityDef>;
  readonly bases: ReadonlyArray<BaseDef>;
}

export interface RolledAffix {
  readonly affixID: string;
  readonly groupID: string;
  readonly value: number;
}

export interface RolledAffixes {
  readonly affixes: ReadonlyArray<RolledAffix>;
}

export interface RolledItem extends RolledAffixes {
  readonly baseID: string;
  readonly rarityID: string;
  readonly contentVersion: string;
}

/**
 * The pinned item state a craft action acts on.
 */
export interface ItemState {
  readonly baseID: string;
  readonly rarityID: string;
  readonly affixes: ReadonlyArray<RolledAffix>;
}

/**
 * Closed constraint vocabulary for affix rolls. Fields, not a list — application order is
 * intrinsic to the interpreter, never caller-ordered.
 */
export interface AffixConstraints {
  /**
   * Fixed number of picks; absent, the count is drawn from the rarity's count range.
   */
  readonly count?: number;
  readonly excludeOccupiedGroups?: boolean;

  /**
   * Forced affixes bypass every pool filter, consume one value draw each, and reduce the
   * remaining picks; they must occupy distinct groups and fit inside the count.
   */
  readonly forceAffixIDs?: ReadonlyArray<string>;
  readonly protectGroupIDs?: ReadonlyArray<string>;

  /**
   * Integer weight factor per affix id; a factor of 0 removes the affix from the pool, an id
   * absent from the pool is a no-op.
   */
  readonly reweights?: Readonly<Record<string, number>>;

  /**
   * Redraw only the values of the existing affixes, keeping their identities; affixes in
   * protected groups keep their original values and consume no draw. Combines only with
   * `protectGroupIDs` — any other field set alongside it is rejected.
   */
  readonly valuesOnly?: boolean;
}

export interface AffixPool {
  readonly entries: ReadonlyArray<AffixDef>;
  readonly forced: ReadonlyArray<AffixDef>;
}
