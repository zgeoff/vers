import { Outlet, createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { requireAuth } from '../lib/auth/require-auth';
import { GameNav } from './-game/game-nav';
import { GameSimulationMount } from './-game/game-simulation-mount';

const requireAuthFn = createServerFn({ method: 'GET' }).handler(() => requireAuth());

export const Route = createFileRoute('/_game')({
  component: GameLayout,
  loader: () => requireAuthFn(),
});

function GameLayout() {
  return (
    <>
      <GameSimulationMount />
      <GameNav />
      <Outlet />
    </>
  );
}
