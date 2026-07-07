import { mock } from 'bun:test';

/**
 * Stubs the codex fragment slot: it renders through the Flight pipeline (`CompositeComponent`),
 * untestable under `bun test`'s single module graph, so this replaces the module process-wide,
 * letting tests assert the activity-readiness wiring around it instead of the fragment's own
 * content.
 */
export function registerAetherNodeCodexSlotMock(): void {
  void mock.module('../src/components/aether-node-codex-slot', () => ({
    AetherNodeCodexSlot: () => <p data-testid="aether-node-codex-stub">CODEX</p>,
  }));
}
