import { mock } from 'bun:test';

export function registerAvatarViewerMock(): void {
  void mock.module('../routes/-avatar/avatar-viewer', () => ({
    AvatarViewer: () => <p data-testid="avatar-viewer-stub">AVATAR_VIEWER</p>,
  }));
}
