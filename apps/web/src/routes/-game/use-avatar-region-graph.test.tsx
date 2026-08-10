import { expect, test } from 'bun:test';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as db from '@vers/mock-services/db';
import { buildRegionGraph, useSelectedNode, useWorldGraph } from '@vers/worldmap-client';
import { toNodeID } from '@vers/worldmap-core';
import invariant from 'tiny-invariant';
import { buildQueryClient } from '../../lib/query/build-query-client';
import { createActiveAvatar } from '../../test-utils/create-active-avatar';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { useAvatarRegionGraph } from './use-avatar-region-graph';

function setupAvatarRegionGraph() {
  const queryClient = buildQueryClient();

  const Wrapper = (props: Readonly<{ children: React.ReactNode }>) => (
    <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>
  );

  const hook = renderHook(
    () => {
      useAvatarRegionGraph();

      return { selection: useSelectedNode(), worldGraph: useWorldGraph() };
    },
    { wrapper: Wrapper },
  );

  return { hook, queryClient };
}

test("it builds the active avatar's region graph and selects its origin node", async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ seed: 111, userID: signedIn.userID });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const ctx = setupAvatarRegionGraph();

    await waitFor(() => {
      expect(ctx.hook.result.current.worldGraph).toStrictEqual(buildRegionGraph(avatar.seed, 24));
    });

    expect(ctx.hook.result.current.selection.node?.id).toBe(toNodeID(0, 0));
  });
});

test('it rebuilds the graph and resets the selection when the active avatar changes', async () => {
  const signedIn = await createSignedInUser();
  const first = await createActiveAvatar({ seed: 111, userID: signedIn.userID });
  const second = await db.avatarCollection.create({ seed: 222, userID: signedIn.userID });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const ctx = setupAvatarRegionGraph();

    await waitFor(() => {
      expect(ctx.hook.result.current.worldGraph).toStrictEqual(buildRegionGraph(first.seed, 24));
    });

    const active = db.activeAvatarCollection.findFirst((q) => q.where({ userID: signedIn.userID }));

    invariant(active, 'createActiveAvatar seeds an active-avatar row for this user');

    await db.activeAvatarCollection.update(active, {
      data(record) {
        record.avatarID = second.id;
      },
    });

    await ctx.queryClient.invalidateQueries();

    await waitFor(() => {
      expect(ctx.hook.result.current.worldGraph).toStrictEqual(buildRegionGraph(second.seed, 24));
    });

    expect(ctx.hook.result.current.selection.node?.id).toBe(toNodeID(0, 0));
  });
});
