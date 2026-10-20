import { expect, test } from 'bun:test';
import { isSceneSwap } from './is-scene-swap';
import type { SceneState } from './types';

test('it reports true when the scene key changes', () => {
  const previous: SceneState = { presentation: 'focus', scene: 'worldmap' };
  const next: SceneState = { presentation: 'focus', scene: 'respite' };

  expect(isSceneSwap(previous, next)).toBeTrue();
});

test('it reports false when only presentation changes', () => {
  const previous: SceneState = { presentation: 'focus', scene: 'worldmap' };
  const next: SceneState = { presentation: 'ambient', scene: 'worldmap' };

  expect(isSceneSwap(previous, next)).toBeFalse();
});

test('it reports false when nothing changes', () => {
  const previous: SceneState = { presentation: 'focus', scene: 'worldmap' };
  const next: SceneState = { presentation: 'focus', scene: 'worldmap' };

  expect(isSceneSwap(previous, next)).toBeFalse();
});
