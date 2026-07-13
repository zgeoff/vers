import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import type { ActivitySnapshot } from '@vers/idle-core';
import { setActivity } from './set-activity';
import { useActivityStore } from './use-activity-store';

test('it updates the activity state', () => {
  const activity: ActivitySnapshot = {
    currentWave: null,
    elapsed: 0,
    enemiesRemaining: 20,
    id: '1',
    levelUp: null,
    name: 'Test Activity',
    rewards: { xp: 0 },
    waves: [],
    wavesRemaining: 4,
  };

  setActivity(activity);

  const hook = renderHook(() => useActivityStore((state) => state.activity));

  expect(hook.result.current).toStrictEqual({
    currentWave: null,
    elapsed: 0,
    enemiesRemaining: 20,
    id: '1',
    levelUp: null,
    name: 'Test Activity',
    rewards: { xp: 0 },
    waves: [],
    wavesRemaining: 4,
  });
});
