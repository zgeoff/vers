import { createFileRoute } from '@tanstack/react-router';
import { css } from '@vers/styled-system/css';
import { HomeHero } from './-home/home-hero';
import { LandingSections } from './-home/landing-sections';

export const Route = createFileRoute('/')({
  component: HomePage,
  loader: async (opts) => {
    await opts.context.queryClient
      .ensureQueryData(opts.context.orpc.user.getCurrentUser.queryOptions({ input: {} }))
      .catch(() => {});
  },
});

function HomePage() {
  const ctx = Route.useRouteContext();

  return (
    <main className={css({ display: 'flex', flexDirection: 'column', gap: '4', padding: '6' })}>
      <HomeHero orpc={ctx.orpc} />
      <LandingSections />
    </main>
  );
}
