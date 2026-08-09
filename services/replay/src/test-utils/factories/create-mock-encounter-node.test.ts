import { expect, test } from 'bun:test';
import { createMockEncounterNode } from './create-mock-encounter-node';

test('it builds a node with a positive difficulty and no sealed fields by default', () => {
  const node = createMockEncounterNode();

  expect(node.difficulty).toBeGreaterThanOrEqual(1);
  expect(node.poolID).toBeUndefined();
});

test('it applies overrides over the defaults', () => {
  const node = createMockEncounterNode({ difficulty: 7, poolID: 'brawler-den' });

  expect(node).toStrictEqual({ difficulty: 7, poolID: 'brawler-den' });
});
