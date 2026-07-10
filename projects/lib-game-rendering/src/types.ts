import type { ReactNode } from 'react';

export type SceneKey = 'respite' | 'worldmap';

export type Presentation = 'ambient' | 'focus' | 'hidden';

export interface SceneContribution {
  readonly presentation?: Presentation;
  readonly scene?: SceneKey;
}

export interface SceneState {
  readonly presentation: Presentation;
  readonly scene: SceneKey;
}

export type GameLoopCallback = (delta: number, elapsed: number) => void;

export interface SatelliteEntry {
  readonly element: ReactNode;
  readonly keepAlive: boolean;
}
