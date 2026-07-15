import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { makeNodeTextMatcher } from '@vers/client-test-utils';
import { createMockActivitySnapshot } from '@vers/idle-core/test-utils';
import { ActivityInfo } from './activity-info';

test('it renders info about the provided activity', () => {
  const activity = createMockActivitySnapshot({
    enemiesRemaining: 20,
    id: 'test-activity',
    name: 'Test Activity',
    rewards: { xp: 150 },
    wavesRemaining: 4,
  });

  render(<ActivityInfo activity={activity} />);

  const activityName = screen.getByText('Test Activity');
  const enemiesRemaining = screen.getByText(makeNodeTextMatcher('20 enemies remain'));
  const wavesRemaining = screen.getByText(makeNodeTextMatcher('4 waves remain'));
  const xpEarned = screen.getByText(makeNodeTextMatcher('150 xp earned'));

  expect(activityName).toBeInTheDocument();
  expect(enemiesRemaining).toBeInTheDocument();
  expect(wavesRemaining).toBeInTheDocument();
  expect(xpEarned).toBeInTheDocument();
});
