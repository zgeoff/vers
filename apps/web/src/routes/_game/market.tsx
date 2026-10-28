import { Outlet, createFileRoute, notFound } from '@tanstack/react-router';
import { MarketPanel } from '../-market/market-panel';
import { requireActiveAvatarOrLastKnown } from '../../lib/avatar/require-active-avatar-or-last-known';

export const Route = createFileRoute('/_game/market')({
  beforeLoad: (opts) => {
    if (!opts.context.flags.market) {
      throw notFound();
    }
  },
  component: MarketPage,
  head: () => ({ meta: [{ title: 'vers | Market' }] }),
  loader: (opts) => requireActiveAvatarOrLastKnown(opts.context.queryClient),
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
