export interface RNG {
  getInt: (min: number, max: number) => number;
  getSeries: (min: number, max: number, count: number) => Array<number>;
  getState: () => string;
}

export interface EncounterEnemyAttack {
  readonly maxDamage: number;
  readonly minDamage: number;
  readonly speed: number;
}

export interface EncounterEnemy {
  readonly level: number;
  readonly life: number;
  readonly name: string;
  readonly primaryAttack: EncounterEnemyAttack;
  readonly xp: number;
}

/**
 * A fully resolved world map encounter: ordered waves, each an ordered array of enemies whose
 * stats are already difficulty-scaled. Nothing about it is rolled again once derived.
 */
export interface EncounterDefinition {
  readonly waves: ReadonlyArray<ReadonlyArray<EncounterEnemy>>;
}

export interface EncounterArchetype {
  readonly id: string;
  readonly name: string;
  readonly baseLevel: number;
  readonly baseLife: number;
  readonly baseXP: number;
  readonly attackMin: number;
  readonly attackMax: number;
  readonly attackSpeed: number;
}

export interface EncounterPoolEntry {
  readonly archetypeID: string;
  readonly weight: number;
}

export interface EncounterPool {
  readonly id: string;
  readonly entries: readonly [EncounterPoolEntry, ...ReadonlyArray<EncounterPoolEntry>];
}

export interface EncounterTuning {
  readonly waveCountMin: number;
  readonly waveCountMax: number;
  readonly waveSizeMin: number;
  readonly waveSizeMax: number;
  readonly difficultyScalingFactor: number;
}

/**
 * A content version pins archetype, pool, and tuning data together: any change to any of them is a
 * new version, and every shipped version stays loadable.
 */
export interface EncounterContent {
  readonly contentVersion: string;
  readonly archetypes: ReadonlyArray<EncounterArchetype>;
  readonly pools: readonly [EncounterPool, ...ReadonlyArray<EncounterPool>];
  readonly tuning: EncounterTuning;
}

/**
 * The trajectory facts a derivation resolves an encounter's pool and stat scaling against —
 * expands as node content lands.
 */
export interface EncounterNode {
  readonly difficulty: number;
}
