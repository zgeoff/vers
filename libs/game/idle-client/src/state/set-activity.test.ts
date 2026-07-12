import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import type { ActivityAppState } from '@vers/idle-core';
import { setActivity } from './set-activity';
import { useActivityStore } from './use-activity-store';

test('it updates the activity state', () => {
  const activity: ActivityAppState = {
    currentEnemyGroup: null,
    elapsed: 0,
    enemiesRemaining: 20,
    enemyGroups: [],
    enemyGroupsRemaining: 4,
    id: '1',
    name: 'Test Activity',
    rewards: { xp: 0 },
  };

  setActivity(activity);

  const hook = renderHook(() => useActivityStore((state) => state.activity));

  expect(hook.result.current).toStrictEqual({
    currentEnemyGroup: null,
    elapsed: 0,
    enemiesRemaining: 20,
    enemyGroups: [],
    enemyGroupsRemaining: 4,
    id: '1',
    name: 'Test Activity',
    rewards: { xp: 0 },
  });
});
