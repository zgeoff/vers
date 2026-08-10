import { expect, test } from 'bun:test';
import type { EncounterPoolEntry } from '../../types';
import { createMockEncounterContent } from './create-mock-encounter-content';

test('it builds a coherent encounter content by default', () => {
  const content = createMockEncounterContent();

  expect(content.contentVersion).toBe('2');

  const archetypeIDs = new Set(content.archetypes.map((archetype) => archetype.id));

  expect(content.pools.flatMap((pool) => pool.entries)).toSatisfyAll((entry: EncounterPoolEntry) =>
    archetypeIDs.has(entry.archetypeID),
  );
});

test('it applies an overridden contentVersion', () => {
  const content = createMockEncounterContent({ contentVersion: '5' });

  expect(content.contentVersion).toBe('5');
});
