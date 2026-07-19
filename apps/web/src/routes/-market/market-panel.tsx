import { Link } from '@tanstack/react-router';
import { Heading, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';

interface MarketListing {
  readonly listingID: string;
  readonly title: string;
}

const MARKET_LISTINGS: ReadonlyArray<MarketListing> = [
  { listingID: 'listing-1', title: 'Sunforged Blade' },
  { listingID: 'listing-2', title: 'Warden Plate Greaves' },
  { listingID: 'listing-3', title: 'Ember-Touched Charm' },
];

const panel = css({
  backgroundColor: 'bg.panel',
  borderColor: 'border',
  borderWidth: '[1px]',
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
  margin: '6',
  padding: '6',
});

const list = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
});

const listing = css({
  backgroundColor: 'bg.panelElevated',
  display: 'block',
  padding: '3',
});

/**
 * Renders a static placeholder market screen with a fixed listing list.
 */
export function MarketPanel() {
  return (
    <main className={panel}>
      <Heading level={1}>Market</Heading>
      <ul className={list}>
        {MARKET_LISTINGS.map((entry) => (
          <li key={entry.listingID}>
            <Link
              className={listing}
              params={{ listingID: entry.listingID }}
              to="/market/listing/$listingID"
            >
              <Text>{entry.title}</Text>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
