import { mock } from 'bun:test';

/**
 * Stubs the code-split boundary `AetherPanel`'s own `import('./aether-canvas')` resolves through:
 * three.js and R3F never load under `bun test` (no WebGL in `happy-dom`), so this replaces the
 * module process-wide, letting tests assert the lazy boundary and its loading fallback instead of
 * the canvas's own internals.
 */
export function registerAetherCanvasMock(): void {
  void mock.module('../src/routes/-aether/aether-canvas', () => ({
    AetherCanvas: () => <p data-testid="aether-canvas-stub">AETHER_CANVAS</p>,
  }));
}
