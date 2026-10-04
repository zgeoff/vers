import type { EncounterContent } from '@vers/game-utils';
import type { CorpusContentID } from './types';

export const CORPUS_CONTENT: Readonly<Record<CorpusContentID, EncounterContent>> = {
  baseline: {
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
  },
  'fast-attack': {
    contentVersion: '2',
    archetypes: [
      {
        id: 'placeholder-fast-striker',
        name: 'World Map Fast Striker',
        baseLevel: 1,
        baseLife: 40,
        baseXP: 10,
        attackMin: 1,
        attackMax: 3,

        // matches the avatar's fixed weapon speed, so the avatar and this archetype attack
        // on the same instant every cycle and the total-order tie-break rule always resolves one
        attackSpeed: 0.8,
      },
    ],
    pools: [
      {
        id: 'default',
        entries: [{ archetypeID: 'placeholder-fast-striker', weight: 1 }],
      },
    ],
    tuning: {
      waveCountMin: 2,
      waveCountMax: 4,
      waveSizeMin: 2,
      waveSizeMax: 4,
      difficultyScalingFactor: 1,
    },
  },
};
