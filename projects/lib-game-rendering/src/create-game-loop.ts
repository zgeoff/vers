import type { GameLoopCallback } from './types';

/**
 * Builds an isolated game-loop registry: registered handlers run in the order they were
 * registered, driven only by whoever calls `runGameLoopCallbacks`. The package's real loop uses
 * one shared instance (see the `gameLoop` singleton); this factory lets tests build their own,
 * isolated from one another and from the singleton.
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
