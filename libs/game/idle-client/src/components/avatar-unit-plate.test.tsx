import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { makeNodeTextMatcher } from '@vers/client-test-utils';
import { createMockAvatarSnapshot } from '@vers/idle-core/test-utils';
import { AvatarUnitPlate } from './avatar-unit-plate';

test('it renders the avatar identity, life, and swing timer', () => {
  const avatar = createMockAvatarSnapshot({
    level: 5,
    life: 80,
    maxLife: 100,
    name: 'Vanguard',
  });

  render(<AvatarUnitPlate avatar={avatar} />);

  expect(screen.getByText('Vanguard')).toBeInTheDocument();
  expect(screen.getByText('LV 5')).toBeInTheDocument();
  expect(screen.getByText(makeNodeTextMatcher('80 / 100'))).toBeInTheDocument();
  expect(screen.getByText('STRIKE')).toBeInTheDocument();
});

test('it prefers the display name over the sim-reported name', () => {
  const avatar = createMockAvatarSnapshot({ name: 'avatar_1' });

  render(<AvatarUnitPlate avatar={avatar} displayName="Aria" />);

  expect(screen.getByText('Aria')).toBeInTheDocument();
  expect(screen.queryByText('avatar_1')).not.toBeInTheDocument();
});
