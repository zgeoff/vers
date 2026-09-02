import type { AnyRouter, ParsedLocation } from '@tanstack/react-router';
import { resolveSceneState } from '@vers/game-rendering';
import type { SceneState } from '@vers/game-rendering';

export function resolveSceneStateForLocation(
  router: AnyRouter,
  location: Readonly<Pick<ParsedLocation, 'pathname' | 'search'>>,
  previous: SceneState,
): SceneState {
  // `staticData` isn't reachable from the router's `types` view-transition callback, which only
  // receives locations, so this runs `matchRoutes` itself to recover the matched branch and folds
  // its root-first contributions against `previous` the way the live route-to-store sync does.
  const matches = router.matchRoutes(location.pathname, location.search);

  return resolveSceneState(
    matches.map((match) => match.staticData),
    previous,
  );
}
