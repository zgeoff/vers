import { mock } from 'bun:test';

/**
 * Stubs the codex fragment slot so tests can assert the activity-readiness wiring around it
 * rather than the fragment's own content.
 */
export function registerWorldMapNodeCodexSlotMock(): void {
  void mock.module('../components/world-map-node-codex-slot', () => ({
    WorldMapNodeCodexSlot: () => <p data-testid="world-map-node-codex-stub">CODEX</p>,
  }));
}
