import { resolveSceneState } from './resolve-scene-state';
import type { SceneContribution } from './types';
import { useSceneStateStore } from './use-scene-state-store';

export function setSceneState(contributions: ReadonlyArray<SceneContribution | undefined>) {
  useSceneStateStore.setState(resolveSceneState(contributions, useSceneStateStore.getState()));
}
