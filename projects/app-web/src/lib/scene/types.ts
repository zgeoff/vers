import type { Presentation, SceneKey } from '@vers/game-rendering';

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    readonly presentation?: Presentation;
    readonly scene?: SceneKey;
  }
}
