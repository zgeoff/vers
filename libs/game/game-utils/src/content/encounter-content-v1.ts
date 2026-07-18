import type { EncounterContent } from '../types';

/**
 * Machinery-exercising placeholder content: two archetypes in one pool, 3-6 waves of 3-6 enemies
 * each, and a 1x content multiplier so stats scale by node difficulty alone. Frozen — a content
 * change is a new version module, never an edit here.
 */
export const encounterContentV1: EncounterContent = {
  contentVersion: '1',
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
  ],
  pools: [
    {
      id: 'default',
      entries: [
        { archetypeID: 'placeholder-brawler', weight: 1 },
        { archetypeID: 'placeholder-skirmisher', weight: 1 },
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
