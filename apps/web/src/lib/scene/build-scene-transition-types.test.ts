import { expect, test } from 'bun:test';
import type { SceneState } from '@vers/game-rendering';
import { buildSceneTransitionTypes } from './build-scene-transition-types';

test('it returns scene-swap when the scene key changes and presentation stays the same', () => {
  const previous: SceneState = { presentation: 'focus', scene: 'worldmap' };
  const next: SceneState = { presentation: 'focus', scene: 'respite' };

  expect(buildSceneTransitionTypes(previous, next)).toStrictEqual(['scene-swap']);
});

test('it returns to-ambient when presentation moves to ambient without a scene swap', () => {
  const previous: SceneState = { presentation: 'focus', scene: 'worldmap' };
  const next: SceneState = { presentation: 'ambient', scene: 'worldmap' };

  expect(buildSceneTransitionTypes(previous, next)).toStrictEqual(['to-ambient']);
});

test('it returns to-focus when presentation moves to focus without a scene swap', () => {
  const previous: SceneState = { presentation: 'ambient', scene: 'worldmap' };
  const next: SceneState = { presentation: 'focus', scene: 'worldmap' };

  expect(buildSceneTransitionTypes(previous, next)).toStrictEqual(['to-focus']);
});

test('it returns to-hidden when presentation moves to hidden without a scene swap', () => {
  const previous: SceneState = { presentation: 'focus', scene: 'worldmap' };
  const next: SceneState = { presentation: 'hidden', scene: 'worldmap' };

  expect(buildSceneTransitionTypes(previous, next)).toStrictEqual(['to-hidden']);
});

test('it returns same-scene when neither the scene key nor presentation changes', () => {
  const previous: SceneState = { presentation: 'focus', scene: 'worldmap' };
  const next: SceneState = { presentation: 'focus', scene: 'worldmap' };

  expect(buildSceneTransitionTypes(previous, next)).toStrictEqual(['same-scene']);
});

test('it composes scene-swap with a presentation type when a swap also changes presentation', () => {
  const previous: SceneState = { presentation: 'ambient', scene: 'worldmap' };
  const next: SceneState = { presentation: 'focus', scene: 'respite' };

  expect(buildSceneTransitionTypes(previous, next)).toIncludeSameMembers([
    'scene-swap',
    'to-focus',
  ]);
});
