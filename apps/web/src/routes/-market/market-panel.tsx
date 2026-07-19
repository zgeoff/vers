import { Link } from '@tanstack/react-router';
import { Tabs, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { ScreenLayout } from '../../components/screen-layout';
import { ScreenPanel } from '../../components/screen-panel';

interface MarketListing {
  readonly listingID: string;
  readonly title: string;
}

const MARKET_LISTINGS: ReadonlyArray<MarketListing> = [
  { listingID: 'listing-1', title: 'Sunforged Blade' },
  { listingID: 'listing-2', title: 'Warden Plate Greaves' },
  { listingID: 'listing-3', title: 'Ember-Touched Charm' },
];

export function MarketPanel() {
  return (
    <ScreenLayout title="Market">
      <Tabs
        items={[
          { content: <SearchTab />, label: 'Search', value: 'search' },
          { content: <ListingsTab />, label: 'Listings', value: 'listings' },
          { content: <SellTab />, label: 'Sell', value: 'sell' },
        ]}
      />
    </ScreenLayout>
  );
}

const list = css({ display: 'flex', flexDirection: 'column', gap: '2' });
const listing = css({ backgroundColor: 'bg.panelElevated', display: 'block', padding: '3' });

function ListingsTab() {
  return (
    <ScreenPanel label="Listings">
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
    </ScreenPanel>
  );
}

function SearchTab() {
  return (
    <>
      <ScreenPanel label="Filter builder" />
      <ScreenPanel label="Stat search" />
    </>
  );
}

function SellTab() {
  return (
    <>
      <ScreenPanel label="Your items" />
      <ScreenPanel label="Price & list" />
    </>
  );
}
