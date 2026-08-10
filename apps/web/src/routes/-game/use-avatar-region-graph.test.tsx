import { expect, test } from 'bun:test';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as db from '@vers/mock-services/db';
import { buildRegionGraph, useSelectedNode, useWorldGraph } from '@vers/worldmap-client';
import type { WorldGraph } from '@vers/worldmap-client';
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

/**
 * Waits until the store holds the graph generated from `seed`, then asserts full graph equality
 * once. The waitFor polls only the origin node: a full-graph comparison inside the retry loop
 * formats a multi-thousand-line diff on every mismatch, starving the event loop of the query fetch
 * the assertion is waiting on.
 */
async function waitForRegionGraph(readWorldGraph: () => WorldGraph, seed: number) {
  const expected = buildRegionGraph(seed, 24);
  const expectedOrigin = expected.nodes[toNodeID(0, 0)];

  invariant(expectedOrigin, 'the generated region always contains its origin cell');

  await waitFor(() => {
    expect(readWorldGraph().nodes[toNodeID(0, 0)]).toStrictEqual(expectedOrigin);
  });

  expect(readWorldGraph()).toStrictEqual(expected);

  return expected;
}

test("it builds the active avatar's region graph and selects its origin node", async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ seed: 111, userID: signedIn.userID });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const ctx = setupAvatarRegionGraph();

    await waitForRegionGraph(() => ctx.hook.result.current.worldGraph, avatar.seed);

    expect(ctx.hook.result.current.selection.node?.id).toBe(toNodeID(0, 0));
  });
});

test('it rebuilds the graph and resets the selection when the active avatar changes', async () => {
  const signedIn = await createSignedInUser();
  const first = await createActiveAvatar({ seed: 333, userID: signedIn.userID });
  const second = await db.avatarCollection.create({ seed: 444, userID: signedIn.userID });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const ctx = setupAvatarRegionGraph();

    await waitForRegionGraph(() => ctx.hook.result.current.worldGraph, first.seed);

    const active = db.activeAvatarCollection.findFirst((q) => q.where({ userID: signedIn.userID }));

    invariant(active, 'createActiveAvatar seeds an active-avatar row for this user');

    await db.activeAvatarCollection.update(active, {
      data(record) {
        record.avatarID = second.id;
      },
    });

    await ctx.queryClient.invalidateQueries();

    const secondExpected = await waitForRegionGraph(
      () => ctx.hook.result.current.worldGraph,
      second.seed,
    );

    // the origin node's id is '0_0' for every seed, but its jittered position is seed-specific —
    // asserting the node object proves the selection moved to the new avatar's origin
    expect(ctx.hook.result.current.selection.node).toStrictEqual(
      secondExpected.nodes[toNodeID(0, 0)] ?? null,
    );
  });
});
