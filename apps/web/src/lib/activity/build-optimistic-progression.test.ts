import { expect, test } from 'bun:test';
import { buildOptimisticProgression } from './build-optimistic-progression';

test('it sums the anchor xp and the running sim delta when the sim matches the current activity', () => {
  const result = buildOptimisticProgression({
    avatar: { level: 3, xp: 450 },
    currentActivity: { buildSnapshot: { level: 3, xp: 400 }, id: 'activity_1' },
    simActivity: { id: 'activity_1', rewards: { xp: 25 } },
    simAvatar: { level: 4 },
  });

  expect(result).toStrictEqual({ level: 4, xp: 425 });
});

test('it falls back to the anchor alone when no sim is running', () => {
  const result = buildOptimisticProgression({
    avatar: { level: 3, xp: 450 },
    currentActivity: { buildSnapshot: { level: 3, xp: 400 }, id: 'activity_1' },
  });

  expect(result).toStrictEqual({ level: 3, xp: 400 });
});

test('it ignores a sim delta from a different activity than the current one', () => {
  const result = buildOptimisticProgression({
    avatar: { level: 3, xp: 450 },
    currentActivity: { buildSnapshot: { level: 3, xp: 400 }, id: 'activity_1' },
    simActivity: { id: 'activity_2', rewards: { xp: 25 } },
    simAvatar: { level: 4 },
  });

  expect(result).toStrictEqual({ level: 4, xp: 400 });
});

test('it renders the settled avatar row when no activity is current', () => {
  const result = buildOptimisticProgression({
    avatar: { level: 5, xp: 900 },
    currentActivity: null,
    simActivity: { id: 'activity_1', rewards: { xp: 25 } },
    simAvatar: { level: 6 },
  });

  expect(result).toStrictEqual({ level: 5, xp: 900 });
});
