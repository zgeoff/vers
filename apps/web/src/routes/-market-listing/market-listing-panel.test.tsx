import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { MarketListingPanel } from './market-listing-panel';

test('it shows the listing id and placeholder detail text', () => {
  render(<MarketListingPanel listingID="listing-1" />);

  expect(screen.getByRole('heading', { name: 'Listing listing-1' })).toBeVisible();
  expect(screen.getByText('Full listing details are coming soon.')).toBeVisible();
});
