import { createFileRoute } from '@tanstack/react-router';
import { Heading } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { Suspense } from 'react';
import { CurrentUserPanel } from '../components/current-user-panel';
import { SessionBadgeSlot } from '../components/session-badge-slot';
import { getHomeContent } from '../lib/session/get-home-content';
import { sessionBadgeQueryOptions } from '../lib/session/session-badge-query-options';
import { HomeHero } from './-home/home-hero';
import { LandingSections } from './-home/landing-sections';

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

const diagnosticsStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
  marginTop: '8',
});

function HomePage() {
  const data = Route.useLoaderData();
  const ctx = Route.useRouteContext();

  return (
    <main className={css({ display: 'flex', flexDirection: 'column', gap: '4', padding: '6' })}>
      <HomeHero orpc={ctx.orpc} />
      <LandingSections />
      <section className={diagnosticsStyles}>
        <Heading level={2}>Diagnostics</Heading>
        {data.Content}
        <CurrentUserPanel orpc={ctx.orpc} />
        <Suspense fallback={<p data-testid="session-badge-loading">Loading session badge…</p>}>
          <SessionBadgeSlot />
        </Suspense>
      </section>
    </main>
  );
}
