import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { makeNodeTextMatcher } from '@vers/client-test-utils';
import { createMockActivitySnapshot } from '@vers/idle-core/test-utils';
import { MissionHeader } from './mission-header';

test('it reports the encounter name, cleared waves, enemies left, and banked xp', () => {
  const activity = createMockActivitySnapshot({
    enemiesRemaining: 2,
    name: 'World Map Encounter',
    rewards: { xp: 162 },
    waves: [
      { enemies: [], id: 'w1' },
      { enemies: [], id: 'w2' },
      { enemies: [], id: 'w3' },
      { enemies: [], id: 'w4' },
    ],
    wavesRemaining: 1,
  });

  render(<MissionHeader activity={activity} />);
  expect(screen.getByText('World Map Encounter')).toBeInTheDocument();

  expect(
    screen.getByText(makeNodeTextMatcher('3 of 4 waves cleared · 2 enemies left')),
  ).toBeInTheDocument();

  expect(screen.getByText(makeNodeTextMatcher('+162 XP'))).toBeInTheDocument();
});
