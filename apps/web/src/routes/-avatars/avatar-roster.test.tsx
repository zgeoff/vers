import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { createMockAvatar } from '../../test-utils/factories/create-mock-avatar';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { AvatarRoster } from './avatar-roster';

test('it links each avatar into the game and offers a create slot', async () => {
  const avatar = createMockAvatar({ name: 'Karnak' });

  renderWithRouter(<AvatarRoster avatars={[avatar]} />);

  const card = await screen.findByRole('link', { name: /Karnak/ });

  expect(card).toHaveAttribute('href', '/explore');

  expect(screen.getByRole('link', { name: /Create avatar/ })).toHaveAttribute(
    'href',
    '/avatars/create',
  );
});

test('it shows only the create slot when the account has no avatars', async () => {
  renderWithRouter(<AvatarRoster avatars={[]} />);

  const createLink = await screen.findByRole('link', { name: /Create avatar/ });

  expect(createLink).toHaveAttribute('href', '/avatars/create');
  expect(screen.queryByText(/Level/)).not.toBeInTheDocument();
});
