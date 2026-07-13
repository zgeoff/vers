import { mock } from 'bun:test';

/**
 * Stubs the codex slot — the UI mount — so tests can assert the activity-readiness wiring
 * around it rather than the fragment payload it renders.
 */
export function registerWorldMapNodeCodexSlotMock(): void {
  void mock.module('../components/world-map-node-codex-slot', () => ({
    WorldMapNodeCodexSlot: () => <p data-testid="world-map-node-codex-stub">CODEX</p>,
  }));
}
