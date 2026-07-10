import { expect, test } from 'bun:test';
import { setSceneState } from './set-scene-state';
import { useSceneStateStore } from './use-scene-state-store';

test('it applies the fold against the current store state', () => {
  setSceneState([{ presentation: 'focus', scene: 'respite' }]);

  expect(useSceneStateStore.getState()).toStrictEqual({
    presentation: 'focus',
    scene: 'respite',
  });
});

test('it keeps the store state sticky when the branch declares nothing', () => {
  setSceneState([{ presentation: 'focus', scene: 'respite' }]);
  setSceneState([undefined]);

  expect(useSceneStateStore.getState()).toStrictEqual({
    presentation: 'focus',
    scene: 'respite',
  });
});
