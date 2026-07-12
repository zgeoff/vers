import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import type { ActivityAppState } from '@vers/idle-core';
import { setActivity } from './set-activity';
import { useActivity } from './use-activity';

test('it provides activity state', () => {
  const activity: ActivityAppState = {
    currentWave: null,
    elapsed: 0,
    enemiesRemaining: 20,
    id: 'test-activity',
    levelUp: null,
    name: 'Test Activity',
    rewards: { xp: 0 },
    waves: [],
    wavesRemaining: 4,
  };

  setActivity(activity);

  const hook = renderHook(() => useActivity());

  expect(hook.result.current).toStrictEqual({
    currentWave: null,
    elapsed: 0,
    enemiesRemaining: 20,
    id: 'test-activity',
    levelUp: null,
    name: 'Test Activity',
    rewards: { xp: 0 },
    waves: [],
    wavesRemaining: 4,
  });
});
