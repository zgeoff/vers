import { mock } from 'bun:test';

/**
 * Stubs the codex fragment slot so tests can assert the activity-readiness wiring around it
 * rather than the fragment's own content.
 */
export function registerAetherNodeCodexSlotMock(): void {
  void mock.module('../components/aether-node-codex-slot', () => ({
    AetherNodeCodexSlot: () => <p data-testid="aether-node-codex-stub">CODEX</p>,
  }));
}
