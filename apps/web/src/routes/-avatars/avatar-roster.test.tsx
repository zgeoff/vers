import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { AVATAR_MODE_CAP } from '@vers/contract-avatar';
import { createMockAvatar } from '../../test-utils/factories/create-mock-avatar';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { AvatarRoster } from './avatar-roster';

test('it renders each avatar as a selectable card and offers a create slot', async () => {
  const avatar = createMockAvatar({ name: 'Karnak' });

  renderWithRouter(<AvatarRoster roster={{ activeAvatarID: null, avatars: [avatar] }} />);

  const card = await screen.findByRole('button', { name: /Karnak/ });

  expect(card).toBeEnabled();

  expect(screen.getByRole('link', { name: /Create avatar/ })).toHaveAttribute(
    'href',
    '/avatars/create',
  );
});

test('it marks the active avatar', async () => {
  const active = createMockAvatar({ name: 'Karnak' });
  const idle = createMockAvatar({ name: 'Zetha' });

  renderWithRouter(
    <AvatarRoster roster={{ activeAvatarID: active.id, avatars: [active, idle] }} />,
  );

  const activeCard = await screen.findByRole('button', { name: /Karnak/ });

  const idleCard = screen.getByRole('button', { name: /Zetha/ });

  expect(activeCard).toHaveTextContent('Active');
  expect(idleCard).not.toHaveTextContent('Active');
});

test('it shows only the create slot when the account has no avatars', async () => {
  renderWithRouter(<AvatarRoster roster={{ activeAvatarID: null, avatars: [] }} />);

  const createLink = await screen.findByRole('link', { name: /Create avatar/ });

  expect(createLink).toHaveAttribute('href', '/avatars/create');
  expect(screen.queryByText(/Level/)).not.toBeInTheDocument();
});

test('it hides the create slot when every mode is at its cap', async () => {
  const avatars = [
    ...Array.from({ length: AVATAR_MODE_CAP }, () => createMockAvatar({ mode: 'trade' })),
    ...Array.from({ length: AVATAR_MODE_CAP }, () => createMockAvatar({ mode: 'self_found' })),
  ];

  renderWithRouter(<AvatarRoster roster={{ activeAvatarID: null, avatars }} />);

  await screen.findByRole('heading', { name: /Choose your avatar/ });

  expect(screen.queryByRole('link', { name: /Create avatar/ })).not.toBeInTheDocument();
});
