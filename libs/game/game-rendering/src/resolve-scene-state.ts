import type { SceneContribution, SceneState } from './types';

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
