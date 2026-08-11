import { expect, mock, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import { mockActivityService } from '@vers/mock-services/activity';
import { setViewport } from '@vers/worldmap-client';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';
import { server } from '../../mocks/node';
import { createActiveAvatar } from '../../test-utils/create-active-avatar';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { renderHook } from '../../test-utils/render-hook';
import { withRequestContext } from '../../test-utils/with-request-context';
import { useRevealedNodesQuery } from './use-revealed-nodes-query';

test('it queries revealed nodes for a chunk-aligned viewport once the camera reports one', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.getRevealedNodes.handler((opts) => {
      track(opts.input);

      return { contentVersion: 'v1', nodes: [] };
    }),
  );

  setViewport({ maxCX: 17, maxCY: 20, minCX: 1, minCY: -1 });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderHook(() => {
      useRevealedNodesQuery();
    });

    await waitFor(() => {
      expect(track).toHaveBeenCalledExactlyOnceWith({
        avatarID: avatar.id,
        viewport: { maxCX: 31, maxCY: 31, minCX: 0, minCY: -16 },
      });
    });
  });
});

test('it queries nothing before the camera has reported a viewport', async () => {
  const signedIn = await createSignedInUser();

  await createActiveAvatar({ userID: signedIn.userID });

  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.getRevealedNodes.handler((opts) => {
      track(opts.input);

      return { contentVersion: 'v1', nodes: [] };
    }),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const hook = renderHook(() => {
      useRevealedNodesQuery();
    });

    // wait for the active-avatar read this hook also depends on to settle, giving a
    // would-be-enabled reveal query the same window to have fired
    await waitFor(() => {
      const cached = hook.queryClient.getQueryData(buildActiveAvatarQueryOptions().queryKey);

      expect(cached).toBeDefined();
    });

    expect(track).not.toHaveBeenCalled();
  });
});
