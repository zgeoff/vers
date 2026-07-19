import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { NavRail } from './nav-rail';

test('it links every rail destination to its route', async () => {
  renderWithRouter(<NavRail />, { flags: { 'game-renderer': true, market: true } });

  await screen.findByRole('link', { name: /Engagement/ });

  expect(screen.getByRole('link', { name: /Engagement/ })).toHaveAttribute('href', '/activity');
  expect(screen.getByRole('link', { name: /Respite/ })).toHaveAttribute('href', '/respite');
  expect(screen.getByRole('link', { name: /Explore/ })).toHaveAttribute('href', '/explore');
  expect(screen.getByRole('link', { name: /Avatar/ })).toHaveAttribute('href', '/avatar');
  expect(screen.getByRole('link', { name: /Stash/ })).toHaveAttribute('href', '/stash');
  expect(screen.getByRole('link', { name: /Market/ })).toHaveAttribute('href', '/market');
  expect(screen.getByRole('link', { name: /Codex/ })).toHaveAttribute('href', '/codex');
  expect(screen.getByRole('link', { name: /Settings/ })).toHaveAttribute('href', '/settings');
});

test('it hides the Market destination when the market flag is off', async () => {
  renderWithRouter(<NavRail />, { flags: { 'game-renderer': true, market: false } });

  await screen.findByRole('link', { name: /Respite/ });

  expect(screen.queryByRole('link', { name: /Market/ })).not.toBeInTheDocument();
});

test('it marks the followed destination as the current page', async () => {
  const user = userEvent.setup();

  renderWithRouter(<NavRail />, { flags: { 'game-renderer': true, market: true } });

  const stashLink = await screen.findByRole('link', { name: /Stash/ });

  expect(stashLink).not.toHaveAttribute('aria-current');

  await user.click(stashLink);

  expect(screen.getByRole('link', { name: /Stash/ })).toHaveAttribute('aria-current', 'page');
});
