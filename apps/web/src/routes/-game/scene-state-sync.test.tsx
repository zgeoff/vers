import { expect, test } from 'bun:test';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { render, waitFor } from '@testing-library/react';
import { getSceneState } from '@vers/game-rendering';
import { SceneStateSync } from './scene-state-sync';

test('it forwards the matched route branch staticData into the scene store', async () => {
  const rootRoute = createRootRoute({
    component: () => <SceneStateSync />,
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

  await waitFor(() => {
    expect(getSceneState().presentation).toBe('focus');
  });

  expect(getSceneState()).toStrictEqual({ presentation: 'focus', scene: 'worldmap' });
});
