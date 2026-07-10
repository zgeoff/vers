import { Scene } from '@vers/aether-client';
import { useSceneState } from '@vers/game-rendering';
import type { ReactNode } from 'react';

/**
 * The app's scene registry: renders the world matching the scene store's current key. `respite`
 * has no scene component yet, so it renders nothing until a later issue adds one.
 */
export function SceneRoot(): ReactNode {
  const scene = useSceneState().scene;

  if (scene === 'worldmap') {
    return <Scene />;
  }

  return null;
}
