import { Outlet, createFileRoute } from '@tanstack/react-router';
import { MarketPanel } from '../-market/market-panel';

export const Route = createFileRoute('/_game/market')({
  component: MarketPage,
  head: () => ({ meta: [{ title: 'vers | Market' }] }),
  staticData: { presentation: 'ambient' },
});

function MarketPage() {
  return (
    <>
      <MarketPanel />
      <Outlet />
    </>
  );
}
