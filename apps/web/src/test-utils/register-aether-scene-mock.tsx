import { mock } from 'bun:test';
import * as aetherClient from '@vers/aether-client';

/**
 * Stubs the aether client's three.js `Scene` while forwarding every other export untouched:
 * `Scene` renders R3F host elements that throw outside a real `Canvas`, so `SceneRoot`'s registry
 * logic needs a stand-in to render under `bun test`. The real module is captured in this file's own
 * static import — ahead of the `mock.module` call that replaces its registry entry — since
 * re-importing it from inside the mock factory would recurse into the mock itself.
 */
export function registerAetherSceneMock(): void {
  void mock.module('@vers/aether-client', () => ({
    ...aetherClient,
    Scene: () => <p data-testid="aether-scene-stub">AETHER_SCENE</p>,
  }));
}
