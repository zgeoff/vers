import type { GameLoopCallback } from './types';

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
