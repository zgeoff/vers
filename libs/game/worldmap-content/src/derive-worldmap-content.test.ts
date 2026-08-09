import { expect, test } from 'bun:test';
import type { EncounterContent } from '@vers/game-utils';
import invariant from 'tiny-invariant';
import { deriveWorldmapContent } from './derive-worldmap-content';

const scopeSecret = new Uint8Array(32).fill(0x0b);

const CONTENT_V1: EncounterContent = {
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
  ],
  pools: [{ id: 'default', entries: [{ archetypeID: 'placeholder-brawler', weight: 1 }] }],
  tuning: {
    waveCountMin: 3,
    waveCountMax: 6,
    waveSizeMin: 3,
    waveSizeMax: 6,
    difficultyScalingFactor: 1,
  },
};

const CONTENT_V2: EncounterContent = {
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

test('it stamps no sealed fields for content version 1', () => {
  const result = deriveWorldmapContent(CONTENT_V1, { coord: [3, -2], scopeSecret, userSeed: 0 });

  expect(result).toStrictEqual({});
});

test('it stamps a poolID drawn from the registered pool list for content version 2', () => {
  const result = deriveWorldmapContent(CONTENT_V2, { coord: [3, -2], scopeSecret, userSeed: 0 });

  invariant(result.poolID !== undefined, 'content version 2 must stamp a poolID');

  const poolIDs = CONTENT_V2.pools.map((pool) => pool.id);

  expect(poolIDs).toContain(result.poolID);
});

test('it stamps deterministically for identical input', () => {
  const input = { coord: [3, -2], scopeSecret, userSeed: 0 } as const;

  expect(deriveWorldmapContent(CONTENT_V2, input)).toStrictEqual(
    deriveWorldmapContent(CONTENT_V2, input),
  );
});

test('it selects across every registered pool over a spread of coordinates', () => {
  const poolIDs = new Set(
    Array.from(
      { length: 50 },
      (_, i) =>
        deriveWorldmapContent(CONTENT_V2, { coord: [i, -i], scopeSecret, userSeed: 0 }).poolID,
    ),
  );

  expect([...poolIDs]).toIncludeSameMembers(CONTENT_V2.pools.map((pool) => pool.id));
});
