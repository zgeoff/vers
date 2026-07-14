import { expect, test } from 'bun:test';
import { getSceneState } from './get-scene-state';
import { useSceneStateStore } from './use-scene-state-store';

test('it returns the current scene state without subscribing', () => {
  useSceneStateStore.setState({ presentation: 'focus', scene: 'respite' });

  expect(getSceneState()).toStrictEqual({ presentation: 'focus', scene: 'respite' });
});
