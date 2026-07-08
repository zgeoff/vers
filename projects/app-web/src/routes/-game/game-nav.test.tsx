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

  expect(screen.queryByRole('link', { name: /Nexus/ })).not.toBeInTheDocument();

  await user.click(menuButton);

  expect(screen.getByRole('link', { name: /Nexus/ })).toHaveAttribute('href', '/nexus');
  expect(screen.getByRole('link', { name: /Aether/ })).toHaveAttribute('href', '/aether');
  expect(screen.getByRole('link', { name: /Avatar/ })).toHaveAttribute('href', '/avatar');
  expect(screen.getByRole('link', { name: /Account/ })).toHaveAttribute('href', '/account');
});

test('it closes the link list once a link is followed', async () => {
  const user = userEvent.setup();

  setNavigationVisible(true);

  renderWithRouter(<GameNav />);

  const nexusLink = await screen.findByRole('link', { name: /Nexus/ });

  await user.click(nexusLink);

  expect(screen.queryByRole('link', { name: /Nexus/ })).not.toBeInTheDocument();
});
