import { faker } from '@faker-js/faker';
import type { ContentDocument } from '../../content-document-schema';

export function createMockContentDocument(
  overrides: Partial<ContentDocument> = {},
): ContentDocument {
  const contentVersion = overrides.contentVersion ?? faker.string.numeric(6);

  return {
    contentVersion,
    encounter: {
      contentVersion,
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
    loot: {
      contentVersion,
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
    ...overrides,
  };
}
