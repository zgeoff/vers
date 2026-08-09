import type { LootTables } from '../types';

/**
 * Machinery-exercising placeholder content: every rarity path, both interpreter entry points, and
 * every constraint kind are reachable, and no rarity's count range exceeds the distinct group
 * count, so the pool-exhaustion clamp never fires on this version. Frozen — a content change is a
 * new version module, never an edit here.
 */
export const tablesV2: LootTables = {
  contentVersion: '2',
  rarities: [
    { id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 },
    { id: 'magic', weight: 25, affixCountMin: 1, affixCountMax: 2 },
    { id: 'rare', weight: 5, affixCountMin: 2, affixCountMax: 2 },
  ],
  bases: [
    { id: 'placeholder-blade', weight: 60 },
    { id: 'placeholder-focus', weight: 40 },
  ],
  affixes: [
    { id: 'flat-power', groupID: 'power', weight: 3, valueMin: 1, valueMax: 10 },
    { id: 'pct-power', groupID: 'power', weight: 1, valueMin: 1, valueMax: 5 },
    { id: 'flat-guard', groupID: 'guard', weight: 3, valueMin: 1, valueMax: 10 },
    { id: 'pct-guard', groupID: 'guard', weight: 1, valueMin: 1, valueMax: 5 },
  ],
};
