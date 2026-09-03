import { mock } from 'bun:test';

export function registerWorldMapNodeCodexSlotMock(): void {
  void mock.module('../components/world-map-node-codex-slot', () => ({
    WorldMapNodeCodexSlot: () => <p data-testid="world-map-node-codex-stub">CODEX</p>,
  }));
}
