import { mock } from 'bun:test';

/**
 * Stubs the lazy-loaded canvas module: three.js and R3F never load under `bun test` (no WebGL in
 * `happy-dom`), so tests can assert the lazy boundary and its loading fallback instead of the
 * canvas internals.
 */
export function registerAetherCanvasMock(): void {
  void mock.module('../routes/-aether/aether-canvas', () => ({
    AetherCanvas: () => <p data-testid="aether-canvas-stub">AETHER_CANVAS</p>,
  }));
}
