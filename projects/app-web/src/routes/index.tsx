import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { renderServerComponent } from '@tanstack/react-start/rsc';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { Heading, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { Suspense } from 'react';
import { CurrentUserPanel } from '../components/current-user-panel';
import { SessionBadgeSlot } from '../components/session-badge-slot';
import { pickSessionHeaders } from '../lib/rpc/pick-session-headers';
import { readCurrentUserResult } from '../lib/session/read-current-user-result';
import { sessionBadgeQueryOptions } from '../lib/session/session-badge-query';

/** GET server function: fetches the acting session server-side and renders the matching fragment. */
const getHomeContent = createServerFn({ method: 'GET' }).handler(async () => {
  const result = await readCurrentUserResult(pickSessionHeaders(getRequestHeaders()));

  const HomeContent = result.authenticated ? (
    <SignedInHome name={result.user.name} />
  ) : (
    <AnonHome />
  );

  const Renderable = await renderServerComponent(HomeContent);

  return { Renderable };
});

export const Route = createFileRoute('/')({
  component: HomePage,
  loader: async (opts) => {
    const [{ Renderable }] = await Promise.all([
      getHomeContent(),
      opts.context.queryClient
        .ensureQueryData(
          opts.context.orpc.user.getCurrentUser.queryOptions({ input: {}, retry: false }),
        )
        .catch(() => {}),
      opts.context.queryClient.ensureQueryData(sessionBadgeQueryOptions),
    ]);

    return { Content: Renderable };
  },
});

function HomePage() {
  const { Content } = Route.useLoaderData();
  const { orpc } = Route.useRouteContext();

  return (
    <main className={css({ display: 'flex', flexDirection: 'column', gap: '4', padding: '6' })}>
      {Content}
      <CurrentUserPanel orpc={orpc} />
      <Suspense fallback={<p data-testid="session-badge-loading">Loading session badge…</p>}>
        <SessionBadgeSlot />
      </Suspense>
    </main>
  );
}

function AnonHome() {
  return (
    <section>
      <Heading level={1}>vers</Heading>
      <Text data-testid="home-anon">You are not signed in.</Text>
    </section>
  );
}

function SignedInHome(props: Readonly<{ name: string }>) {
  return (
    <section>
      <Heading level={1}>vers</Heading>
      <Text data-testid="home-signed-in">Welcome back, {props.name}.</Text>
    </section>
  );
}
