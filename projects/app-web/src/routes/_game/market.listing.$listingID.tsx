import { createFileRoute } from '@tanstack/react-router';
import { MarketListingPanel } from '../-market-listing/market-listing-panel';

export const Route = createFileRoute('/_game/market/listing/$listingID')({
  component: MarketListingRoute,
  head: () => ({ meta: [{ title: 'vers | Market Listing' }] }),
});

function MarketListingRoute() {
  const params = Route.useParams();

  return <MarketListingPanel listingID={params.listingID} />;
}
