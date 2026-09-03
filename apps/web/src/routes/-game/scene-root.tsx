import { useSceneState } from '@vers/game-rendering';
import { Scene } from '@vers/worldmap-client';
import type { ReactNode } from 'react';
import { RespiteScene } from './respite-scene';

export function SceneRoot(): ReactNode {
  const scene = useSceneState((state) => state.scene);

  if (scene === 'worldmap') {
    return <Scene />;
  }

  if (scene === 'respite') {
    return <RespiteScene />;
  }

  return null;
}
