import { mock } from 'bun:test';

export function registerGameCanvasMock(): void {
  void mock.module('../routes/-game/game-world', () => ({
    GameWorld: () => <p data-testid="game-canvas-stub">GAME_CANVAS</p>,
  }));
}
