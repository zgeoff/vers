import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { MarketPanel } from './market-panel';

test('it links each listing to its detail route from the listings tab', async () => {
  const user = userEvent.setup();

  renderWithRouter(<MarketPanel />);

  const listingsTab = await screen.findByRole('tab', { name: 'Listings' });

  await user.click(listingsTab);

  const listingLink = screen.getByRole('link', { name: 'Sunforged Blade' });

  expect(listingLink).toHaveAttribute('href', '/market/listing/listing-1');
});
