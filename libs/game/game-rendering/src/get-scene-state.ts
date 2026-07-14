import type { SceneState } from './types';
import { useSceneStateStore } from './use-scene-state-store';

/**
 * Imperative read of the current scene state for non-React callers (router transition callbacks);
 * components subscribe through the reactive hook instead.
 */
export function getSceneState(): SceneState {
  return useSceneStateStore.getState();
}
