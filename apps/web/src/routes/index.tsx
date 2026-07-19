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

const page = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6',
  marginX: 'auto',
  maxWidth: '5xl',
  paddingX: '6',
  paddingY: '10',
  width: 'full',
});

function HomePage() {
  const ctx = Route.useRouteContext();

  return (
    <main className={page}>
      <HomeHero orpc={ctx.orpc} />
      <LandingSections />
    </main>
  );
}
