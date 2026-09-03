import { mock } from 'bun:test';
import * as worldClient from '@vers/worldmap-client';

export function registerWorldmapSceneMock(): void {
  // the real module is captured by this file's static import, ahead of this replacement:
  // re-importing it inside the factory would recurse into the mock itself
  void mock.module('@vers/worldmap-client', () => ({
    ...worldClient,
    Scene: () => <p data-testid="world-scene-stub">WORLDMAP_SCENE</p>,
  }));
}
