import { expect, test } from 'bun:test';
import type { EncounterContent } from '@vers/game-utils';
import { buildMockScopeSecret } from '@vers/mock-services/keys';
import { getDifficulty } from '@vers/worldmap-core';
import { createMockEncounterNode } from '../test-utils/factories/create-mock-encounter-node';
import { findDescriptorDivergence } from './find-descriptor-divergence';

const scopeSecret = buildMockScopeSecret('avatar_1', 'worldmap', 1);

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

test('it finds no divergence when the stamped fields match the recomputed truth for a v1 node', () => {
  const difficulty = getDifficulty(1, 0);

  const divergence = findDescriptorDivergence({
    content: CONTENT_V1,
    scopeID: '1_0',
    scopeSecret,
    stampedEncounterNode: createMockEncounterNode({ difficulty }),
  });

  expect(divergence).toBeUndefined();
});

test('it finds no divergence when a v2 stamped poolID matches the recomputed truth', () => {
  const difficulty = getDifficulty(1, 0);

  const truthDivergence = findDescriptorDivergence({
    content: CONTENT_V2,
    scopeID: '1_0',
    scopeSecret,
    stampedEncounterNode: createMockEncounterNode({ difficulty, poolID: 'brawler-den' }),
  });

  const otherDivergence = findDescriptorDivergence({
    content: CONTENT_V2,
    scopeID: '1_0',
    scopeSecret,
    stampedEncounterNode: createMockEncounterNode({ difficulty, poolID: 'skirmisher-flock' }),
  });

  // exactly one of the two pool ids matches the sealed truth for this scope secret and coordinate
  expect([truthDivergence, otherDivergence].filter((d) => d === undefined)).toHaveLength(1);
});

test('it finds a divergence when the stamped difficulty disagrees with the recomputed coordinate', () => {
  const divergence = findDescriptorDivergence({
    content: CONTENT_V1,
    scopeID: '1_0',
    scopeSecret,
    stampedEncounterNode: createMockEncounterNode({ difficulty: 99 }),
  });

  expect(divergence).toStrictEqual({
    kind: 'divergence',
    reason: 'descriptor-mismatch',
    version: 1,
  });
});

test('it finds a divergence when the stamped poolID disagrees with the sealed truth', () => {
  const difficulty = getDifficulty(1, 0);

  const divergence = findDescriptorDivergence({
    content: CONTENT_V2,
    scopeID: '1_0',
    scopeSecret,
    stampedEncounterNode: createMockEncounterNode({ difficulty, poolID: 'not-a-real-pool' }),
  });

  expect(divergence).toStrictEqual({
    kind: 'divergence',
    reason: 'descriptor-mismatch',
    version: 1,
  });
});

test('it finds a divergence when the scope id no longer resolves to a coordinate', () => {
  const divergence = findDescriptorDivergence({
    content: CONTENT_V1,
    scopeID: 'not_a_real_node',
    scopeSecret,
    stampedEncounterNode: createMockEncounterNode({ difficulty: 1 }),
  });

  expect(divergence).toStrictEqual({
    kind: 'divergence',
    reason: 'descriptor-mismatch',
    version: 1,
  });
});
