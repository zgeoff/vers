import { mock } from 'bun:test';
import * as worldClient from '@vers/worldmap-client';

/**
 * Stubs the world client's three.js `Scene` while forwarding every other export untouched:
 * `Scene` renders R3F host elements that throw outside a real `Canvas`, so `SceneRoot`'s registry
 * logic needs a stand-in to render under `bun test`. The real module is captured in this file's own
 * static import — ahead of the `mock.module` call that replaces its registry entry — since
 * re-importing it from inside the mock factory would recurse into the mock itself.
 */
export function registerWorldmapSceneMock(): void {
  void mock.module('@vers/worldmap-client', () => ({
    ...worldClient,
    Scene: () => <p data-testid="world-scene-stub">WORLDMAP_SCENE</p>,
  }));
}
