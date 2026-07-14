import { expect, test } from 'bun:test';
import { createMockActivitySnapshot } from './create-mock-activity-snapshot';

test('it builds a snapshot with no waves remaining and no rewards yet', () => {
  const snapshot = createMockActivitySnapshot();

  expect(snapshot.currentWave).toBeNull();
  expect(snapshot.waves).toStrictEqual([]);
  expect(snapshot.wavesRemaining).toBe(0);
  expect(snapshot.rewards).toStrictEqual({ xp: 0 });
  expect(snapshot.id).toBeString();
});

test('it applies overrides over the defaults', () => {
  const snapshot = createMockActivitySnapshot({ elapsed: 42, id: 'activity-1' });

  expect(snapshot.elapsed).toBe(42);
  expect(snapshot.id).toBe('activity-1');
});
