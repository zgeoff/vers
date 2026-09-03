import { isSceneSwap } from '@vers/game-rendering';
import type { SceneState } from '@vers/game-rendering';

export function buildSceneTransitionTypes(previous: SceneState, next: SceneState): Array<string> {
  const types: Array<string> = [];

  if (isSceneSwap(previous, next)) {
    types.push('scene-swap');
  }

  if (next.presentation !== previous.presentation) {
    types.push(`to-${next.presentation}`);
  }

  if (types.length === 0) {
    types.push('same-scene');
  }

  return types;
}
