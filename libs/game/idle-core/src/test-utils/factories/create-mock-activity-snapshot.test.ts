import { expect, test } from 'bun:test';
import { createMockActivitySnapshot } from './create-mock-activity-snapshot';

test('it builds a snapshot with no waves remaining and no rewards yet', () => {
  const snapshot = createMockActivitySnapshot();

  expect(snapshot).toStrictEqual({
    currentWave: null,
    elapsed: 0,
    enemiesRemaining: 0,
    id: expect.toBeString(),
    levelUp: null,
    name: 'World Map Encounter',
    rewards: { xp: 0 },
    waves: [],
    wavesRemaining: 0,
  });
});

test('it applies overrides over the defaults', () => {
  const snapshot = createMockActivitySnapshot({ elapsed: 42, id: 'activity-1' });

  expect(snapshot).toStrictEqual({
    currentWave: null,
    elapsed: 42,
    enemiesRemaining: 0,
    id: 'activity-1',
    levelUp: null,
    name: 'World Map Encounter',
    rewards: { xp: 0 },
    waves: [],
    wavesRemaining: 0,
  });
});
