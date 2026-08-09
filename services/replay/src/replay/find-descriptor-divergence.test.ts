import { expect, test } from 'bun:test';
import { buildMockScopeSecret } from '@vers/mock-services/keys';
import { getDifficulty } from '@vers/worldmap-core';
import { createMockEncounterNode } from '../test-utils/factories/create-mock-encounter-node';
import { findDescriptorDivergence } from './find-descriptor-divergence';

const scopeSecret = buildMockScopeSecret('avatar_1', 'worldmap', 1);

test('it finds no divergence when the stamped fields match the recomputed truth for a v1 node', () => {
  const difficulty = getDifficulty(1, 0);

  const divergence = findDescriptorDivergence({
    contentVersion: '1',
    scopeID: '1_0',
    scopeSecret,
    stampedEncounterNode: createMockEncounterNode({ difficulty }),
  });

  expect(divergence).toBeUndefined();
});

test('it finds no divergence when a v2 stamped poolID matches the recomputed truth', () => {
  const difficulty = getDifficulty(1, 0);

  const truthDivergence = findDescriptorDivergence({
    contentVersion: '2',
    scopeID: '1_0',
    scopeSecret,
    stampedEncounterNode: createMockEncounterNode({ difficulty, poolID: 'brawler-den' }),
  });

  const otherDivergence = findDescriptorDivergence({
    contentVersion: '2',
    scopeID: '1_0',
    scopeSecret,
    stampedEncounterNode: createMockEncounterNode({ difficulty, poolID: 'skirmisher-flock' }),
  });

  // exactly one of the two pool ids matches the sealed truth for this scope secret and coordinate
  expect([truthDivergence, otherDivergence].filter((d) => d === undefined)).toHaveLength(1);
});

test('it finds a divergence when the stamped difficulty disagrees with the recomputed coordinate', () => {
  const divergence = findDescriptorDivergence({
    contentVersion: '1',
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
    contentVersion: '2',
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
    contentVersion: '1',
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
