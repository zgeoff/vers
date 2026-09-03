import { mock } from 'bun:test';

export function registerRespiteSceneMock(): void {
  void mock.module('../routes/-game/respite-scene', () => ({
    RespiteScene: () => <p data-testid="respite-scene-stub">RESPITE_SCENE</p>,
  }));
}
