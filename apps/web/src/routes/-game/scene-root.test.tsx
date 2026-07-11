import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { setSceneState } from '@vers/game-rendering';
import { SceneRoot } from './scene-root';

test('it renders the aether scene for the worldmap scene key', async () => {
  setSceneState([{ scene: 'worldmap' }]);

  render(<SceneRoot />);

  const scene = await screen.findByTestId('aether-scene-stub');

  expect(scene).toBeVisible();
});

test('it renders the respite scene for the respite scene key', async () => {
  setSceneState([{ scene: 'respite' }]);

  render(<SceneRoot />);

  const scene = await screen.findByTestId('respite-scene-stub');

  expect(scene).toBeVisible();
});
