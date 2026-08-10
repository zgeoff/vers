import { expect, test } from 'bun:test';
import { ContentDocumentSchema } from './content-document-schema';

test('it accepts a document whose versions all agree', () => {
  const result = ContentDocumentSchema.safeParse({
    contentVersion: '1',
    encounter: {
      contentVersion: '1',
      archetypes: [
        {
          id: 'archetype-a',
          name: 'Archetype A',
          baseLevel: 1,
          baseLife: 10,
          baseXP: 5,
          attackMin: 1,
          attackMax: 2,
          attackSpeed: 0.5,
        },
      ],
      pools: [{ id: 'pool-a', entries: [{ archetypeID: 'archetype-a', weight: 1 }] }],
      tuning: {
        waveCountMin: 3,
        waveCountMax: 6,
        waveSizeMin: 3,
        waveSizeMax: 6,
        difficultyScalingFactor: 1,
      },
    },
    loot: {
      contentVersion: '1',
      rarities: [{ id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 }],
      bases: [{ id: 'base-a', weight: 60 }],
      affixes: [{ id: 'affix-a', groupID: 'group-a', weight: 3, valueMin: 1, valueMax: 10 }],
    },
  });

  expect(result.success).toBeTrue();
});

test('it rejects an empty contentVersion', () => {
  const result = ContentDocumentSchema.safeParse({
    contentVersion: '',
    encounter: {
      contentVersion: '',
      archetypes: [
        {
          id: 'archetype-a',
          name: 'Archetype A',
          baseLevel: 1,
          baseLife: 10,
          baseXP: 5,
          attackMin: 1,
          attackMax: 2,
          attackSpeed: 0.5,
        },
      ],
      pools: [{ id: 'pool-a', entries: [{ archetypeID: 'archetype-a', weight: 1 }] }],
      tuning: {
        waveCountMin: 3,
        waveCountMax: 6,
        waveSizeMin: 3,
        waveSizeMax: 6,
        difficultyScalingFactor: 1,
      },
    },
    loot: {
      contentVersion: '',
      rarities: [{ id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 }],
      bases: [{ id: 'base-a', weight: 60 }],
      affixes: [{ id: 'affix-a', groupID: 'group-a', weight: 3, valueMin: 1, valueMax: 10 }],
    },
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['contentVersion'] }),
  );
});

test('it rejects a document whose encounter contentVersion disagrees', () => {
  const result = ContentDocumentSchema.safeParse({
    contentVersion: '1',
    encounter: {
      contentVersion: '2',
      archetypes: [
        {
          id: 'archetype-a',
          name: 'Archetype A',
          baseLevel: 1,
          baseLife: 10,
          baseXP: 5,
          attackMin: 1,
          attackMax: 2,
          attackSpeed: 0.5,
        },
      ],
      pools: [{ id: 'pool-a', entries: [{ archetypeID: 'archetype-a', weight: 1 }] }],
      tuning: {
        waveCountMin: 3,
        waveCountMax: 6,
        waveSizeMin: 3,
        waveSizeMax: 6,
        difficultyScalingFactor: 1,
      },
    },
    loot: {
      contentVersion: '1',
      rarities: [{ id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 }],
      bases: [{ id: 'base-a', weight: 60 }],
      affixes: [{ id: 'affix-a', groupID: 'group-a', weight: 3, valueMin: 1, valueMax: 10 }],
    },
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['encounter', 'contentVersion'] }),
  );
});

test('it rejects a document whose loot contentVersion disagrees', () => {
  const result = ContentDocumentSchema.safeParse({
    contentVersion: '1',
    encounter: {
      contentVersion: '1',
      archetypes: [
        {
          id: 'archetype-a',
          name: 'Archetype A',
          baseLevel: 1,
          baseLife: 10,
          baseXP: 5,
          attackMin: 1,
          attackMax: 2,
          attackSpeed: 0.5,
        },
      ],
      pools: [{ id: 'pool-a', entries: [{ archetypeID: 'archetype-a', weight: 1 }] }],
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
      rarities: [{ id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 }],
      bases: [{ id: 'base-a', weight: 60 }],
      affixes: [{ id: 'affix-a', groupID: 'group-a', weight: 3, valueMin: 1, valueMax: 10 }],
    },
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['loot', 'contentVersion'] }),
  );
});
