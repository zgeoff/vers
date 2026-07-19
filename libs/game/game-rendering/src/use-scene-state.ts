import type { SceneState } from './types';
import { useSceneStateStore } from './use-scene-state-store';

/**
 * Subscribes to the scene store. Pass a selector to subscribe to a derived slice, so a consumer
 * that only reads one field re-renders only when that field changes; the default returns the whole
 * state.
 */
export function useSceneState(): SceneState;
export function useSceneState<Selected>(selector: (state: SceneState) => Selected): Selected;

export function useSceneState<Selected>(
  selector: (state: SceneState) => Selected | SceneState = (state) => state,
): Selected | SceneState {
  return useSceneStateStore(selector);
}
