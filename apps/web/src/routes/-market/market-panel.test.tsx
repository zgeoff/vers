import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { MarketPanel } from './market-panel';

test('it renders the market title and links each listing to its detail route', async () => {
  renderWithRouter(<MarketPanel />);

  const heading = await screen.findByRole('heading', { name: 'Market' });

  expect(heading).toBeVisible();

  const listingLink = screen.getByRole('link', { name: 'Sunforged Blade' });

  expect(listingLink).toHaveAttribute('href', '/market/listing/listing-1');
});
