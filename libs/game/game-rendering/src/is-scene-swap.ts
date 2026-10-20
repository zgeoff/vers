import type { SceneState } from './types';

export function isSceneSwap(previous: SceneState, next: SceneState): boolean {
  return previous.scene !== next.scene;
}
