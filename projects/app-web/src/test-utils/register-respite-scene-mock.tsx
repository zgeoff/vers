import { mock } from 'bun:test';

/**
 * Stubs the respite placeholder scene: it renders R3F host elements that throw outside a real
 * `Canvas`, so `SceneRoot`'s registry logic needs a stand-in to render under `bun test`.
 */
export function registerRespiteSceneMock(): void {
  void mock.module('../routes/-game/respite-scene', () => ({
    RespiteScene: () => <p data-testid="respite-scene-stub">RESPITE_SCENE</p>,
  }));
}
