import { expect, test } from 'bun:test';
import { isSceneSwap } from './is-scene-swap';
import type { SceneState } from './types';

test('it reports true when the scene key changes', () => {
  const a: SceneState = { presentation: 'focus', scene: 'worldmap' };
  const b: SceneState = { presentation: 'focus', scene: 'respite' };

  expect(isSceneSwap(a, b)).toBeTrue();
});

test('it reports false when only presentation changes', () => {
  const a: SceneState = { presentation: 'focus', scene: 'worldmap' };
  const b: SceneState = { presentation: 'ambient', scene: 'worldmap' };

  expect(isSceneSwap(a, b)).toBeFalse();
});

test('it reports false when nothing changes', () => {
  const a: SceneState = { presentation: 'focus', scene: 'worldmap' };
  const b: SceneState = { presentation: 'focus', scene: 'worldmap' };

  expect(isSceneSwap(a, b)).toBeFalse();
});
