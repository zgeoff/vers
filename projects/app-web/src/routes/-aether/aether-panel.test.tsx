import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { AetherPanel } from './aether-panel';

test('it renders the canvas behind a code-split boundary', async () => {
  render(<AetherPanel />);

  const canvas = await screen.findByTestId('aether-canvas-stub');

  expect(canvas).toBeVisible();
});
