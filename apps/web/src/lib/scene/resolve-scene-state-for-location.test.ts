import { expect, test } from 'bun:test';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import type { SceneState } from '@vers/game-rendering';
import { resolveSceneStateForLocation } from './resolve-scene-state-for-location';

function setupTest() {
  const rootRoute = createRootRoute({ staticData: { presentation: 'ambient' } });

  const worldmapRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/worldmap',
    staticData: { presentation: 'focus', scene: 'worldmap' },
  });

  const stashRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/stash',
    staticData: { presentation: 'ambient' },
  });

  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/worldmap'] }),
    routeTree: rootRoute.addChildren([worldmapRoute, stashRoute]),
  });

  return { router };
}

test('it folds the matched branch staticData for the given location against the previous state', () => {
  const ctx = setupTest();
  const previous: SceneState = { presentation: 'hidden', scene: 'respite' };

  const next = resolveSceneStateForLocation(
    ctx.router,
    { pathname: '/worldmap', search: {} },
    previous,
  );

  expect(next).toStrictEqual({ presentation: 'focus', scene: 'worldmap' });
});

test('it keeps the previous scene when the target branch declares no scene', () => {
  const ctx = setupTest();
  const previous: SceneState = { presentation: 'focus', scene: 'worldmap' };

  const next = resolveSceneStateForLocation(
    ctx.router,
    { pathname: '/stash', search: {} },
    previous,
  );

  expect(next).toStrictEqual({ presentation: 'ambient', scene: 'worldmap' });
});
