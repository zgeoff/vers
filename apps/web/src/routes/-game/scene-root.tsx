import { Scene } from '@vers/aether-client';
import { useSceneState } from '@vers/game-rendering';
import type { ReactNode } from 'react';
import { RespiteScene } from './respite-scene';

/**
 * The app's scene registry: renders the world matching the scene store's current key.
 */
export function SceneRoot(): ReactNode {
  const scene = useSceneState().scene;

  if (scene === 'worldmap') {
    return <Scene />;
  }

  if (scene === 'respite') {
    return <RespiteScene />;
  }

  return null;
}
