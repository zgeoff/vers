import { createFileRoute } from '@tanstack/react-router';
import { css } from '@vers/styled-system/css';
import { loadCurrentUser } from '../lib/session/load-current-user';
import { HomeHero } from './-home/home-hero';
import { LandingSections } from './-home/landing-sections';

export const Route = createFileRoute('/')({
  component: HomePage,
  loader: () => loadCurrentUser(),
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
  const user = Route.useLoaderData();

  return (
    <main className={page}>
      <HomeHero user={user} />
      <LandingSections />
    </main>
  );
}
