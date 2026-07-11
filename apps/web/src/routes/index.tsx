import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { Brand, Heading, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { Suspense } from 'react';
import { CurrentUserPanel } from '../components/current-user-panel';
import { SessionBadgeSlot } from '../components/session-badge-slot';
import type { OrpcQueryUtils } from '../lib/rpc/orpc';
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

const heroStyles = css({ display: 'flex', flexDirection: 'column', gap: '2' });

const linkRowStyles = css({ display: 'flex', gap: '4' });

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

function HomeHero(props: Readonly<{ orpc: OrpcQueryUtils }>) {
  const query = useQuery(props.orpc.user.getCurrentUser.queryOptions({ input: {} }));

  return (
    <section className={heroStyles}>
      <Brand size="xl" />
      {!query.isPending &&
        (query.error ? (
          <>
            <Heading level={2}>Welcome to vers</Heading>
            <Text>Sign in to enter the game, or create an account to get started.</Text>
            <nav className={linkRowStyles}>
              <Link to="/login">Log in</Link>
              <Link to="/signup">Sign up</Link>
            </nav>
          </>
        ) : (
          <>
            <Heading level={2}>Welcome back, {query.data.name}.</Heading>
            <nav className={linkRowStyles}>
              <Link to="/respite">Enter game</Link>
              <Link to="/account">Account</Link>
            </nav>
          </>
        ))}
    </section>
  );
}
