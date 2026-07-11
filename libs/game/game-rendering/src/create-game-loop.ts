import type { GameLoopCallback } from './types';

/**
 * Builds an isolated game-loop registry: registered handlers run in the order they were
 * registered, driven only by whoever calls `runGameLoopCallbacks`. The package's real loop uses
 * one shared instance built from this factory; calling it again gives tests their own registry,
 * isolated from that shared instance and from one another.
 */
export function createGameLoop() {
  const handlers: Array<GameLoopCallback> = [];

  const registerGameLoopCallback = (handler: GameLoopCallback): (() => void) => {
    handlers.push(handler);

    return () => {
      const index = handlers.indexOf(handler);

      if (index !== -1) {
        handlers.splice(index, 1);
      }
    };
  };

  const runGameLoopCallbacks = (delta: number, elapsed: number): void => {
    for (const handler of handlers) {
      handler(delta, elapsed);
    }
  };

  return { registerGameLoopCallback, runGameLoopCallbacks };
}
