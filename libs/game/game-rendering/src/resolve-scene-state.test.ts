import { expect, test } from 'bun:test';
import { resolveSceneState } from './resolve-scene-state';
import type { SceneState } from './types';

test('it takes the deepest declared scene in the branch', () => {
  const previous: SceneState = { presentation: 'focus', scene: 'respite' };

  const result = resolveSceneState(
    [{ scene: 'worldmap' }, { scene: 'respite' }, { scene: 'worldmap' }],
    previous,
  );

  expect(result.scene).toBe('worldmap');
});

test('it takes the deepest declared presentation in the branch', () => {
  const previous: SceneState = { presentation: 'hidden', scene: 'worldmap' };

  const result = resolveSceneState(
    [{ presentation: 'focus' }, { presentation: 'ambient' }],
    previous,
  );

  expect(result.presentation).toBe('ambient');
});

test('it keeps the previous scene when no contribution declares one', () => {
  const previous: SceneState = { presentation: 'focus', scene: 'respite' };

  const result = resolveSceneState([{ presentation: 'ambient' }, undefined], previous);

  expect(result.scene).toBe('respite');
});

test('it keeps the previous presentation when no contribution declares one', () => {
  const previous: SceneState = { presentation: 'ambient', scene: 'worldmap' };

  const result = resolveSceneState([{ scene: 'respite' }, undefined], previous);

  expect(result.presentation).toBe('ambient');
});

test('it keeps the entire previous state when the branch is empty', () => {
  const previous: SceneState = { presentation: 'ambient', scene: 'respite' };

  const result = resolveSceneState([], previous);

  expect(result).toStrictEqual(previous);
});

test('it keeps the entire previous state when every contribution is undefined', () => {
  const previous: SceneState = { presentation: 'focus', scene: 'worldmap' };

  const result = resolveSceneState([undefined, undefined], previous);

  expect(result).toStrictEqual(previous);
});

test('it applies a root-declared scene that no leaf overrides', () => {
  const previous: SceneState = { presentation: 'hidden', scene: 'worldmap' };

  const result = resolveSceneState([{ scene: 'respite' }, undefined, {}], previous);

  expect(result).toStrictEqual({ presentation: 'hidden', scene: 'respite' });
});

test('it lets a leaf override a root-declared scene within the same branch', () => {
  const previous: SceneState = { presentation: 'hidden', scene: 'worldmap' };

  const result = resolveSceneState(
    [{ presentation: 'focus', scene: 'respite' }, { presentation: 'ambient' }],
    previous,
  );

  expect(result).toStrictEqual({ presentation: 'ambient', scene: 'respite' });
});
