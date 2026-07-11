import type { SceneState } from './types';

export function isSceneSwap(a: SceneState, b: SceneState): boolean {
  return a.scene !== b.scene;
}
