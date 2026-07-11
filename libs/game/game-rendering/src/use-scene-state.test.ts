import { expect, test } from 'bun:test';
import { act, renderHook } from '@testing-library/react';
import { setSceneState } from './set-scene-state';
import { useSceneState } from './use-scene-state';

test('it returns the current scene state', () => {
  setSceneState([{ presentation: 'focus', scene: 'respite' }]);

  const hook = renderHook(() => useSceneState());

  expect(hook.result.current).toStrictEqual({
    presentation: 'focus',
    scene: 'respite',
  });
});

test('it reflects a store update after a re-render', () => {
  const hook = renderHook(() => useSceneState());

  act(() => {
    setSceneState([{ presentation: 'ambient', scene: 'worldmap' }]);
  });

  expect(hook.result.current).toStrictEqual({
    presentation: 'ambient',
    scene: 'worldmap',
  });
});
