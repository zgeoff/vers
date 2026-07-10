import { mock } from 'bun:test';

/**
 * Stubs the avatar satellite widget: its R3F `Canvas` throws under `bun test` (no WebGL in
 * `happy-dom`), so tests can assert registration/positioning instead of the canvas internals.
 */
export function registerAvatarViewerMock(): void {
  void mock.module('../routes/-avatar/avatar-viewer', () => ({
    AvatarViewer: () => <p data-testid="avatar-viewer-stub">AVATAR_VIEWER</p>,
  }));
}
