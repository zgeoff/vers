import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { createMockAvatarData } from '@vers/contract-avatar/test-utils';
import { AvatarContent } from './avatar-content';

test('it shows the avatar name', () => {
  const avatar = createMockAvatarData({ name: 'Karnak' });

  render(<AvatarContent avatar={avatar} />);
  expect(screen.getByText('Karnak')).toBeVisible();
});
