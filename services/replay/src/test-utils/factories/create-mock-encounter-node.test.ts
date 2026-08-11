import { expect, test } from 'bun:test';
import { createMockEncounterNode } from './create-mock-encounter-node';

test('it builds a default encounter node', () => {
  const node = createMockEncounterNode();

  expect(node).toStrictEqual({ difficulty: expect.toBeWithin(1, 101) });
});

test('it applies overrides on top of the defaults', () => {
  const node = createMockEncounterNode({ difficulty: 7, poolID: 'brawler-den' });

  expect(node).toStrictEqual({ difficulty: 7, poolID: 'brawler-den' });
});
