import { createFileRoute } from '@tanstack/react-router';
import { css } from '@vers/styled-system/css';
import { Suspense } from 'react';
import { CurrentUserPanel } from '../components/current-user-panel';
import { SessionBadgeSlot } from '../components/session-badge-slot';
import { getHomeContent } from '../lib/session/get-home-content';
import { sessionBadgeQueryOptions } from '../lib/session/session-badge-query-options';

export const Route = createFileRoute('/')({
  component: HomePage,
  loader: async (opts) => {
    const [{ Renderable }] = await Promise.all([
      getHomeContent(),
      opts.context.queryClient
        .ensureQueryData(opts.context.orpc.user.getCurrentUser.queryOptions({ input: {} }))
        .catch(() => {}),
      opts.context.queryClient.ensureQueryData(sessionBadgeQueryOptions),
    ]);

    return { Content: Renderable };
  },
});

function HomePage() {
  const data = Route.useLoaderData();
  const ctx = Route.useRouteContext();

  return (
    <main className={css({ display: 'flex', flexDirection: 'column', gap: '4', padding: '6' })}>
      {data.Content}
      <CurrentUserPanel orpc={ctx.orpc} />
      <Suspense fallback={<p data-testid="session-badge-loading">Loading session badge…</p>}>
        <SessionBadgeSlot />
      </Suspense>
    </main>
  );
}
