import type { EncounterContent } from '../types';

/**
 * Machinery-exercising placeholder content whose multiplier is 1x so stats scale by node
 * difficulty alone. Every pool's weighted-mean `baseXP` is exactly 9, tying the flat-base law to a
 * concrete number: which pool a node's sealed descriptor picks changes flavor, never expected
 * reward magnitude. Frozen — a content change is a new version module, never an edit here.
 */
export const encounterContentV2: EncounterContent = {
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
};
