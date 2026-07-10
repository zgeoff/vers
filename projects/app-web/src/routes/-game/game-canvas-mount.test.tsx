import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { GameCanvasMount } from './game-canvas-mount';

test('it renders the world behind a code-split boundary', async () => {
  render(<GameCanvasMount />);

  const canvas = await screen.findByTestId('game-canvas-stub');

  expect(canvas).toBeVisible();
});
