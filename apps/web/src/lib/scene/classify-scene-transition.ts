import { isSceneSwap } from '@vers/game-rendering';
import type { SceneState } from '@vers/game-rendering';

/**
 * Classifies a scene-state change into router view-transition type names, composable so one
 * transition can carry more than one: `scene-swap` when the scene key changes, plus
 * `to-ambient`/`to-focus`/`to-hidden` (named for `next.presentation`) whenever presentation
 * changes, independent of a scene swap. Neither changing yields `same-scene` alone, covering
 * intra-scene param-only navigations.
 */
export function classifySceneTransition(previous: SceneState, next: SceneState): Array<string> {
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
