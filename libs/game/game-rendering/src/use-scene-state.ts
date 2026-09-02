import type { SceneState } from './types';
import { useSceneStateStore } from './use-scene-state-store';

export function useSceneState(): SceneState;
export function useSceneState<Selected>(selector: (state: SceneState) => Selected): Selected;

export function useSceneState<Selected>(
  selector: (state: SceneState) => Selected | SceneState = (state) => state,
): Selected | SceneState {
  return useSceneStateStore(selector);
}
