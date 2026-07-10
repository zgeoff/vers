import { mock } from 'bun:test';

/**
 * Stubs the lazy-loaded canvas world module: three.js and R3F never load under `bun test` (no
 * WebGL in `happy-dom`), so tests can assert the lazy boundary and its loading fallback instead of
 * the canvas internals.
 */
export function registerGameCanvasMock(): void {
  void mock.module('../routes/-game/game-world', () => ({
    GameWorld: () => <p data-testid="game-canvas-stub">GAME_CANVAS</p>,
  }));
}
