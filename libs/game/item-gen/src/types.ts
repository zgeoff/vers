export interface RewardCoordinate {
  readonly avatarID: string;
  readonly scopeType: string;
  readonly scopeID: string;
  readonly chainIndex: number;
  readonly ordinal: number;
}

export interface CraftPosition {
  readonly avatarID: string;
  readonly position: number;
}

export type RollPosition =
  | (CraftPosition & { readonly kind: 'craft' })
  | (RewardCoordinate & { readonly kind: 'reward' });

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

export interface ItemState {
  readonly baseID: string;
  readonly rarityID: string;
  readonly affixes: ReadonlyArray<RolledAffix>;
}

export interface AffixConstraints {
  readonly count?: number;
  readonly excludeOccupiedGroups?: boolean;

  readonly forceAffixIDs?: ReadonlyArray<string>;
  readonly protectGroupIDs?: ReadonlyArray<string>;

  readonly reweights?: Readonly<Record<string, number>>;

  readonly valuesOnly?: boolean;
}

export interface AffixPool {
  readonly entries: ReadonlyArray<AffixDef>;
  readonly forced: ReadonlyArray<AffixDef>;
}
