import { render, screen } from '@testing-library/react';
import { nodeHasText } from '@vers/client-test-utils';
import type { ActivityAppState } from '@vers/idle-core';
import { expect, test } from 'vitest';
import { ActivityInfo } from './activity-info';

test('it renders info about the provided activity', () => {
  const activity: ActivityAppState = {
    currentEnemyGroup: null,
    elapsed: 0,
    enemiesRemaining: 20,
    enemyGroups: [],
    enemyGroupsRemaining: 4,
    id: 'test-activity',
    name: 'Test Activity',
  };

  render(<ActivityInfo activity={activity} />);

  const activityName = screen.getByText('Test Activity');
  const enemiesRemaining = screen.getByText(nodeHasText('20 enemies remain'));
  const enemyGroupsRemaining = screen.getByText(nodeHasText('4 enemy groups remain'));

  expect(activityName).toBeInTheDocument();
  expect(enemiesRemaining).toBeInTheDocument();
  expect(enemyGroupsRemaining).toBeInTheDocument();
});
