import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { createMockAvatarData } from '../../test-utils/factories/create-mock-avatar-data';
import { AvatarContent } from './avatar-content';

test('it shows the avatar name, level, and xp', () => {
  const avatar = createMockAvatarData({ level: 12, name: 'Karnak', xp: 4500 });

  render(<AvatarContent avatar={avatar} />);
  expect(screen.getByText('Karnak')).toBeVisible();
  expect(screen.getByTestId('avatar-level')).toHaveTextContent('Level 12');
  expect(screen.getByTestId('avatar-xp')).toHaveTextContent('XP: 4500');
});
