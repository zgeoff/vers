import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setNavigationVisible } from '../../state/set-navigation-visible';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { GameNav } from './game-nav';

test('it hides the link list until the menu button is toggled open', async () => {
  const user = userEvent.setup();

  setNavigationVisible(false);

  renderWithRouter(<GameNav />);

  const menuButton = await screen.findByRole('button', { name: /Menu/ });

  expect(screen.queryByRole('link', { name: /Respite/ })).not.toBeInTheDocument();

  await user.click(menuButton);

  expect(screen.getByRole('link', { name: /Respite/ })).toHaveAttribute('href', '/respite');
  expect(screen.getByRole('link', { name: /Explore/ })).toHaveAttribute('href', '/explore');
  expect(screen.getByRole('link', { name: /Stash/ })).toHaveAttribute('href', '/stash');
  expect(screen.getByRole('link', { name: /Market/ })).toHaveAttribute('href', '/market');
  expect(screen.getByRole('link', { name: /Encounter/ })).toHaveAttribute('href', '/encounter');
  expect(screen.getByRole('link', { name: /Avatar/ })).toHaveAttribute('href', '/avatar');
  expect(screen.getByRole('link', { name: /Account/ })).toHaveAttribute('href', '/account');
});

test('it closes the link list once a link is followed', async () => {
  const user = userEvent.setup();

  setNavigationVisible(true);

  renderWithRouter(<GameNav />);

  const respiteLink = await screen.findByRole('link', { name: /Respite/ });

  await user.click(respiteLink);

  expect(screen.queryByRole('link', { name: /Respite/ })).not.toBeInTheDocument();
});
