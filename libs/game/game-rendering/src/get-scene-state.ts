import type { SceneState } from './types';
import { useSceneStateStore } from './use-scene-state-store';

export function getSceneState(): SceneState {
  return useSceneStateStore.getState();
}
