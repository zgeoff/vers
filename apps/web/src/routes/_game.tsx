import { Outlet, createFileRoute, useMatches } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { resolveFlags } from '@vers/flags';
import { requireAuth } from '../lib/auth/require-auth';
import { ActivityProgressNotice } from './-game/activity-progress-notice';
import { AmbientSheet } from './-game/ambient-sheet';
import { GameCanvasMount } from './-game/game-canvas-mount';
import { GameSimulationMount } from './-game/game-simulation-mount';
import { NavRail } from './-game/nav-rail';
import { SatelliteStack } from './-game/satellite-stack';
import { SceneStateSync } from './-game/scene-state-sync';
import { WelcomeBackModal } from './-game/welcome-back-modal';

const requireAuthFn = createServerFn({ method: 'GET' }).handler(() => requireAuth());
const resolveFlagsFn = createServerFn({ method: 'GET' }).handler(() => resolveFlags());

export const Route = createFileRoute('/_game')({
  beforeLoad: async () => ({ flags: await resolveFlagsFn() }),
  component: GameLayout,
  loader: () => requireAuthFn(),
});

function GameLayout() {
  const matches = useMatches();
  const routeContext = Route.useRouteContext();

  // Deepest declaration wins, matching the route-to-store fold; read straight from matches so the
  // wrapper never trails the store's effect-driven update across an ambient↔focus navigation.
  const presentation = matches.findLast((match) => match.staticData.presentation !== undefined)
    ?.staticData.presentation;

  return (
    <>
      <GameCanvasMount gameRenderer={routeContext.flags['game-renderer']} />
      <SatelliteStack />
      <SceneStateSync />
      <GameSimulationMount />
      <WelcomeBackModal />
      <NavRail />
      <ActivityProgressNotice />
      {presentation === 'ambient' ? (
        <AmbientSheet>
          <Outlet />
        </AmbientSheet>
      ) : (
        <Outlet />
      )}
    </>
  );
}
