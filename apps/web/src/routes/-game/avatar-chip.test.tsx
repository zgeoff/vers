import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { AvatarChip } from './avatar-chip';

test('it links to the create sheet when the account has no avatar', async () => {
  renderWithRouter(<AvatarChip />);

  const link = await screen.findByRole('link', { name: 'Create avatar' });

  expect(link).toHaveAttribute('href', '/avatars/create');
});
