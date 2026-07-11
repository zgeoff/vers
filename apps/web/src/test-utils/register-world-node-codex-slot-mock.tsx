import { mock } from 'bun:test';

/**
 * Stubs the codex fragment slot so tests can assert the activity-readiness wiring around it
 * rather than the fragment's own content.
 */
export function registerWorldNodeCodexSlotMock(): void {
  void mock.module('../components/world-node-codex-slot', () => ({
    WorldNodeCodexSlot: () => <p data-testid="world-node-codex-stub">CODEX</p>,
  }));
}
