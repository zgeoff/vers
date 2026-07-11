import { create } from 'zustand';
import type { SceneState } from './types';

export const useSceneStateStore = create<SceneState>(() => ({
  presentation: 'hidden',
  scene: 'worldmap',
}));
