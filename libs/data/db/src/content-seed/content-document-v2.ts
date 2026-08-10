/**
 * Frozen published content — a content change is a new published version, never an edit here.
 */
export const contentDocumentV2 = {
  contentVersion: '2',
  encounter: {
    contentVersion: '2',
    archetypes: [
      {
        id: 'placeholder-brawler',
        name: 'World Map Enemy',
        baseLevel: 1,
        baseLife: 30,
        baseXP: 10,
        attackMin: 1,
        attackMax: 3,
        attackSpeed: 0.5,
      },
      {
        id: 'placeholder-skirmisher',
        name: 'World Map Skirmisher',
        baseLevel: 1,
        baseLife: 20,
        baseXP: 8,
        attackMin: 1,
        attackMax: 4,
        attackSpeed: 0.7,
      },
      {
        id: 'placeholder-stalker',
        name: 'World Map Stalker',
        baseLevel: 1,
        baseLife: 24,
        baseXP: 10,
        attackMin: 2,
        attackMax: 5,
        attackSpeed: 0.9,
      },
    ],
    pools: [
      {
        id: 'brawler-den',
        entries: [
          { archetypeID: 'placeholder-brawler', weight: 1 },
          { archetypeID: 'placeholder-skirmisher', weight: 1 },
        ],
      },
      {
        id: 'skirmisher-flock',
        entries: [
          { archetypeID: 'placeholder-skirmisher', weight: 1 },
          { archetypeID: 'placeholder-stalker', weight: 1 },
        ],
      },
    ],
    tuning: {
      waveCountMin: 3,
      waveCountMax: 6,
      waveSizeMin: 3,
      waveSizeMax: 6,
      difficultyScalingFactor: 1,
    },
  },
  loot: {
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
  },
};
