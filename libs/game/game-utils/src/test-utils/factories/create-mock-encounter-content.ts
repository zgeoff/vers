import type { EncounterContent } from '../../types';

export function createMockEncounterContent(
  overrides: Partial<EncounterContent> = {},
): EncounterContent {
  return {
    contentVersion: overrides.contentVersion ?? '2',
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
    ...overrides,
  };
}
