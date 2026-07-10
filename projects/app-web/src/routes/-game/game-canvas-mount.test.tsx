import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { setSceneState } from '@vers/game-rendering';
import { GameCanvasMount } from './game-canvas-mount';

test('it renders the world behind a code-split boundary', async () => {
  setSceneState([{ presentation: 'focus' }]);

  render(<GameCanvasMount />);

  const canvas = await screen.findByTestId('game-canvas-stub');

  expect(canvas).toBeVisible();
});

test('it dims the canvas container while the scene presentation is ambient', async () => {
  setSceneState([{ presentation: 'focus' }]);

  const focused = render(<GameCanvasMount />);

  await screen.findByTestId('game-canvas-stub');

  const focusedClassName = focused.container.firstElementChild?.className;

  focused.unmount();

  setSceneState([{ presentation: 'ambient' }]);

  const dimmed = render(<GameCanvasMount />);

  await screen.findByTestId('game-canvas-stub');

  expect(dimmed.container.firstElementChild?.className).not.toBe(focusedClassName);
});
