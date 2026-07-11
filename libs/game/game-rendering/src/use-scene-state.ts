import { useSceneStateStore } from './use-scene-state-store';

export function useSceneState() {
  return useSceneStateStore((state) => state);
}
