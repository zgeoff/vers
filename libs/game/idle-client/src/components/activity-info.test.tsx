import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { nodeHasText } from '@vers/client-test-utils';
import type { ActivityAppState } from '@vers/idle-core';
import { ActivityInfo } from './activity-info';

test('it renders info about the provided activity', () => {
  const activity: ActivityAppState = {
    currentEnemyGroup: null,
    elapsed: 0,
    enemiesRemaining: 20,
    enemyGroups: [],
    enemyGroupsRemaining: 4,
    id: 'test-activity',
    levelUp: null,
    name: 'Test Activity',
    rewards: { xp: 150 },
  };

  render(<ActivityInfo activity={activity} />);

  const activityName = screen.getByText('Test Activity');
  const enemiesRemaining = screen.getByText(nodeHasText('20 enemies remain'));
  const enemyGroupsRemaining = screen.getByText(nodeHasText('4 enemy groups remain'));
  const xpEarned = screen.getByText(nodeHasText('150 xp earned'));

  expect(activityName).toBeInTheDocument();
  expect(enemiesRemaining).toBeInTheDocument();
  expect(enemyGroupsRemaining).toBeInTheDocument();
  expect(xpEarned).toBeInTheDocument();
});
