import { gameLoop } from './game-loop';
import type { GameLoopCallback } from './types';

export function registerGameLoopCallback(handler: GameLoopCallback): () => void {
  return gameLoop.registerGameLoopCallback(handler);
}
