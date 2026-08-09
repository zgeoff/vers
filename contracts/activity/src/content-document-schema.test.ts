import { expect, test } from 'bun:test';
import { ContentDocumentSchema } from './content-document-schema';

const VALID_ENCOUNTER = {
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
};

const VALID_LOOT = {
  contentVersion: '1',
  rarities: [{ id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 }],
  bases: [{ id: 'base-a', weight: 60 }],
  affixes: [{ id: 'affix-a', groupID: 'group-a', weight: 3, valueMin: 1, valueMax: 10 }],
};

const VALID_DOCUMENT = { contentVersion: '1', encounter: VALID_ENCOUNTER, loot: VALID_LOOT };

test('it accepts a document whose versions all agree', () => {
  const result = ContentDocumentSchema.safeParse(VALID_DOCUMENT);

  expect(result.success).toBeTrue();
});

test('it rejects an empty contentVersion', () => {
  const result = ContentDocumentSchema.safeParse({
    ...VALID_DOCUMENT,
    contentVersion: '',
    encounter: { ...VALID_ENCOUNTER, contentVersion: '' },
    loot: { ...VALID_LOOT, contentVersion: '' },
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['contentVersion'] }),
  );
});

test('it rejects a document whose encounter contentVersion disagrees', () => {
  const result = ContentDocumentSchema.safeParse({
    ...VALID_DOCUMENT,
    encounter: { ...VALID_ENCOUNTER, contentVersion: '2' },
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['encounter', 'contentVersion'] }),
  );
});

test('it rejects a document whose loot contentVersion disagrees', () => {
  const result = ContentDocumentSchema.safeParse({
    ...VALID_DOCUMENT,
    loot: { ...VALID_LOOT, contentVersion: '2' },
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['loot', 'contentVersion'] }),
  );
});
