import type { SceneContribution, SceneState } from './types';

/**
 * Folds a matched route branch's `staticData` contributions into the next scene state.
 * `contributions` is root-first (index 0 is the outermost matched route, the last element the
 * leaf). The `scene` and `presentation` axes resolve independently: each takes the deepest
 * contribution that declares it, otherwise keeping its value from `previous`.
 */
export function resolveSceneState(
  contributions: ReadonlyArray<SceneContribution | undefined>,
  previous: SceneState,
): SceneState {
  let scene = previous.scene;
  let presentation = previous.presentation;

  for (const contribution of contributions) {
    if (contribution?.scene !== undefined) {
      scene = contribution.scene;
    }

    if (contribution?.presentation !== undefined) {
      presentation = contribution.presentation;
    }
  }

  return { presentation, scene };
}
