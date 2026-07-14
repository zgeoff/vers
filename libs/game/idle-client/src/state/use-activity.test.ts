import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import type { ActivitySnapshot } from '@vers/idle-core';
import { useActivity } from './use-activity';
import { useIdleStore } from './use-idle-store';

test('it provides activity state', () => {
  const activity: ActivitySnapshot = {
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

  useIdleStore.setState({ activity });

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
