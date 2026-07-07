import { expect, mock, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { AetherPanel } from './aether-panel';

/**
 * Stubs the code-split boundary itself, the same seam `AetherPanel`'s own `import('./aether-canvas')`
 * resolves through: three.js and R3F never load under `bun test` (no WebGL in `happy-dom`), and
 * this asserts the lazy boundary and its loading fallback instead of the canvas's own internals.
 */
void mock.module('./aether-canvas', () => ({
  AetherCanvas: () => <p data-testid="aether-canvas-stub">AETHER_CANVAS</p>,
}));

test('it renders the canvas behind a code-split boundary', async () => {
  render(<AetherPanel />);

  const canvas = await screen.findByTestId('aether-canvas-stub');

  expect(canvas).toBeVisible();
});
