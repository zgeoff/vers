import { Outlet, createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { resolveFlags } from '@vers/flags';
import { useSceneState } from '@vers/game-rendering';
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
  const sceneState = useSceneState();

  return (
    <>
      <GameCanvasMount />
      <SatelliteStack />
      <SceneStateSync />
      <GameSimulationMount />
      <WelcomeBackModal />
      <NavRail />
      <ActivityProgressNotice />
      {sceneState.presentation === 'ambient' ? (
        <AmbientSheet>
          <Outlet />
        </AmbientSheet>
      ) : (
        <Outlet />
      )}
    </>
  );
}
