import { gameLoop } from './game-loop';
import type { GameLoopCallback } from './types';

/**
 * Registers `handler` to run every driven frame, in registration order, until the returned
 * function is called. Frames are driven only by the canvas's game-loop driver, so this never
 * fires while the scene's frameloop is `never`.
 */
export function registerGameLoopCallback(handler: GameLoopCallback): () => void {
  return gameLoop.registerGameLoopCallback(handler);
}
