import { expect, test } from 'bun:test';
import { buildLevelFromXP } from '@vers/idle-core';
import { buildOptimisticProgression } from './build-optimistic-progression';

test('it reports the settled row with no settling marker when nothing is pending or in flight', () => {
  const result = buildOptimisticProgression({
    progression: { level: 5, pending: [], xp: 900 },
  });

  expect(result).toStrictEqual({ isSettling: false, level: 5, xp: 900 });
});

test('it sums pending deltas onto the settled xp and recomputes the level', () => {
  const result = buildOptimisticProgression({
    progression: {
      level: 1,
      pending: [
        { activityID: 'activity_1', xpDelta: 150 },
        { activityID: 'activity_2', xpDelta: 75 },
      ],
      xp: 0,
    },
  });

  expect(result).toStrictEqual({ isSettling: true, level: buildLevelFromXP(225), xp: 225 });
});

test('it overlays the live sim delta onto the settled xp when nothing is pending', () => {
  const result = buildOptimisticProgression({
    progression: { level: 3, pending: [], xp: 400 },
    simActivity: { id: 'activity_1', rewards: { xp: 25 } },
  });

  expect(result).toStrictEqual({ isSettling: true, level: buildLevelFromXP(425), xp: 425 });
});

test('it dedupes the sim overlay against a matching pending entry, counting its xp once', () => {
  const result = buildOptimisticProgression({
    progression: {
      level: 1,
      pending: [{ activityID: 'activity_1', xpDelta: 150 }],
      xp: 0,
    },
    simActivity: { id: 'activity_1', rewards: { xp: 150 } },
  });

  expect(result).toStrictEqual({ isSettling: true, level: buildLevelFromXP(150), xp: 150 });
});

test('it sums a pending entry and a differently-id sim overlay together', () => {
  const result = buildOptimisticProgression({
    progression: {
      level: 1,
      pending: [{ activityID: 'activity_1', xpDelta: 150 }],
      xp: 0,
    },
    simActivity: { id: 'activity_2', rewards: { xp: 25 } },
  });

  expect(result).toStrictEqual({ isSettling: true, level: buildLevelFromXP(175), xp: 175 });
});

test('it leaves the display xp unchanged when a delta moves from pending into the settled row', () => {
  const beforeSettlement = buildOptimisticProgression({
    progression: { level: 1, pending: [{ activityID: 'activity_1', xpDelta: 150 }], xp: 300 },
  });

  const afterSettlement = buildOptimisticProgression({
    progression: { level: 1, pending: [], xp: 450 },
  });

  expect(afterSettlement.xp).toBe(beforeSettlement.xp);
});

test('it overlays only the part of the live run the settled row does not already carry', () => {
  const result = buildOptimisticProgression({
    progression: {
      active: { activityID: 'activity_1', settledXP: 90 },
      level: 3,
      pending: [],
      xp: 490,
    },
    simActivity: { id: 'activity_1', rewards: { xp: 120 } },
  });

  expect(result).toStrictEqual({ isSettling: true, level: buildLevelFromXP(520), xp: 520 });
});

test('it leaves the display xp unchanged as the settled row absorbs more of the live run', () => {
  const beforeSettlement = buildOptimisticProgression({
    progression: {
      active: { activityID: 'activity_1', settledXP: 0 },
      level: 3,
      pending: [],
      xp: 400,
    },
    simActivity: { id: 'activity_1', rewards: { xp: 120 } },
  });

  const afterSettlement = buildOptimisticProgression({
    progression: {
      active: { activityID: 'activity_1', settledXP: 90 },
      level: 3,
      pending: [],
      xp: 490,
    },
    simActivity: { id: 'activity_1', rewards: { xp: 120 } },
  });

  expect(afterSettlement.xp).toBe(beforeSettlement.xp);
});

test('it overlays a live run whole when the settled entry belongs to another activity', () => {
  const result = buildOptimisticProgression({
    progression: {
      active: { activityID: 'activity_2', settledXP: 90 },
      level: 3,
      pending: [],
      xp: 400,
    },
    simActivity: { id: 'activity_1', rewards: { xp: 25 } },
  });

  expect(result).toStrictEqual({ isSettling: true, level: buildLevelFromXP(425), xp: 425 });
});
