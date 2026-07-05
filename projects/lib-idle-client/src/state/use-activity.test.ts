import { renderHook } from '@testing-library/react';
import type { ActivityAppState } from '@vers/idle-core';
import { expect, test } from 'vitest';
import { setActivity } from './set-activity';
import { useActivity } from './use-activity';

test('it provides activity state', () => {
  const activity: ActivityAppState = {
    currentEnemyGroup: null,
    elapsed: 0,
    enemiesRemaining: 20,
    enemyGroups: [],
    enemyGroupsRemaining: 4,
    id: 'test-activity',
    name: 'Test Activity',
  };

  setActivity(activity);

  const { result } = renderHook(() => useActivity());

  expect(result.current).toStrictEqual({
    currentEnemyGroup: null,
    elapsed: 0,
    enemiesRemaining: 20,
    enemyGroups: [],
    enemyGroupsRemaining: 4,
    id: 'test-activity',
    name: 'Test Activity',
  });
});
