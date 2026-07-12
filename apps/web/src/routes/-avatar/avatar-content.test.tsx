import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { AvatarContent } from './avatar-content';

const avatar = {
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  id: 'avatar_content',
  level: 12,
  name: 'Karnak',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  userID: 'user_avatar_content',
  xp: 4500,
};

test('it shows the avatar name, level, and xp', () => {
  render(<AvatarContent avatar={avatar} />);
  expect(screen.getByText('Karnak')).toBeVisible();
  expect(screen.getByTestId('avatar-level')).toHaveTextContent('Level 12');
  expect(screen.getByTestId('avatar-xp')).toHaveTextContent('XP: 4500');
});
