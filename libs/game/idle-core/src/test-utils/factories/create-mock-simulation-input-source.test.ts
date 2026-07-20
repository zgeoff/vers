import { expect, test } from 'bun:test';
import { CURRENT_CONTENT_VERSION } from '@vers/game-utils';
import { createMockSimulationInputSource } from './create-mock-simulation-input-source';

test('it creates a simulation input source with expected properties', () => {
  const source = createMockSimulationInputSource();

  expect(source).toStrictEqual({
    avatarID: expect.toBeString(),
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: CURRENT_CONTENT_VERSION,
    encounterNode: { difficulty: 1 },
    id: expect.toStartWith('act_'),
    seed: 'aa'.repeat(16),
  });
});

test('it creates a simulation input source with custom properties', () => {
  const source = createMockSimulationInputSource({
    buildSnapshot: { level: 27, xp: 67_600 },
    encounterNode: { difficulty: 3 },
  });

  expect(source.buildSnapshot).toStrictEqual({ level: 27, xp: 67_600 });
  expect(source.encounterNode).toStrictEqual({ difficulty: 3 });
});
