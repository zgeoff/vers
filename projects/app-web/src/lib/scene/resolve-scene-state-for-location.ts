import type { AnyRouter, ParsedLocation } from '@tanstack/react-router';
import { resolveSceneState } from '@vers/game-rendering';
import type { SceneState } from '@vers/game-rendering';

/**
 * Resolves the scene state a navigation to `location` would produce, without waiting for that
 * navigation to happen: `staticData` isn't reachable from the router's `types` view-transition
 * callback, which only receives locations, so this runs `matchRoutes` itself to recover the
 * matched branch and folds its root-first `scene`/`presentation` contributions against `previous`
 * the same way `SceneStateSync` folds the live match list.
 */
export function resolveSceneStateForLocation(
  router: AnyRouter,
  location: Readonly<Pick<ParsedLocation, 'pathname' | 'search'>>,
  previous: SceneState,
): SceneState {
  const matches = router.matchRoutes(location.pathname, location.search);

  return resolveSceneState(
    matches.map((match) => match.staticData),
    previous,
  );
}
