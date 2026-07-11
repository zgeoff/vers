import { Outlet, createFileRoute, notFound } from '@tanstack/react-router';
import { MarketPanel } from '../-market/market-panel';

export const Route = createFileRoute('/_game/market')({
  beforeLoad: (opts) => {
    if (!opts.context.flags.market) {
      throw notFound();
    }
  },
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
