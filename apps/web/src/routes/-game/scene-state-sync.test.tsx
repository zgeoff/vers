import { expect, test } from 'bun:test';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { useSceneState } from '@vers/game-rendering';
import { SceneStateSync } from './scene-state-sync';

function SceneStateProbe() {
  const sceneState = useSceneState();

  return (
    <p data-testid="scene-state-probe">
      {sceneState.scene}:{sceneState.presentation}
    </p>
  );
}

test('it forwards the matched route branch staticData into the scene store', async () => {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <SceneStateSync />
        <SceneStateProbe />
      </>
    ),
    staticData: { presentation: 'ambient' },
  });

  const worldmapRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/worldmap',
    staticData: { presentation: 'focus', scene: 'worldmap' },
  });

  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/worldmap'] }),
    routeTree: rootRoute.addChildren([worldmapRoute]),
  });

  render(<RouterProvider router={router} />);

  const probe = await screen.findByTestId('scene-state-probe');

  expect(probe).toHaveTextContent('worldmap:focus');
});
