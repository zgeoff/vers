import { Outlet, createFileRoute, notFound } from '@tanstack/react-router';
import { MarketPanel } from '../-market/market-panel';
import { requireActiveAvatar } from '../../lib/avatar/require-active-avatar';

export const Route = createFileRoute('/_game/market')({
  beforeLoad: (opts) => {
    if (!opts.context.flags.market) {
      throw notFound();
    }
  },
  component: MarketPage,
  head: () => ({ meta: [{ title: 'vers | Market' }] }),
  loader: () => requireActiveAvatar(),
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
