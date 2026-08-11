import { expect, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import * as db from '@vers/mock-services/db';
import {
  buildViewportGraph,
  setViewport,
  useSelectedNode,
  useWorldGraph,
} from '@vers/worldmap-client';
import { toNodeID } from '@vers/worldmap-core';
import invariant from 'tiny-invariant';
import { createActiveAvatar } from '../../test-utils/create-active-avatar';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { renderHook } from '../../test-utils/render-hook';
import { withRequestContext } from '../../test-utils/with-request-context';
import { useAvatarRegionGraph } from './use-avatar-region-graph';

const INITIAL_VIEWPORT = { maxCX: 24, maxCY: 24, minCX: -24, minCY: -24 };

test("it builds the active avatar's region graph and selects its origin node", async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ seed: 111, userID: signedIn.userID });

  const expected = buildViewportGraph(avatar.seed, INITIAL_VIEWPORT);
  const expectedOrigin = expected.nodes[toNodeID(0, 0)];

  invariant(expectedOrigin, 'the initial viewport always contains its origin cell');

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const hook = renderHook(() => {
      useAvatarRegionGraph();

      return { selection: useSelectedNode(), worldGraph: useWorldGraph() };
    });

    // poll the origin node alone: a full-graph mismatch diff per retry starves the event loop of
    // the query fetch this wait depends on
    await waitFor(() => {
      expect(hook.result.current.worldGraph.nodes[toNodeID(0, 0)]).toStrictEqual(expectedOrigin);
    });

    expect(hook.result.current.worldGraph).toStrictEqual(expected);
    expect(hook.result.current.selection.node?.id).toBe(toNodeID(0, 0));
  });
});

test('it rebuilds the graph and resets the selection when the active avatar changes', async () => {
  const signedIn = await createSignedInUser();
  const first = await createActiveAvatar({ seed: 333, userID: signedIn.userID });
  const second = await db.avatarCollection.create({ seed: 444, userID: signedIn.userID });

  const firstExpected = buildViewportGraph(first.seed, INITIAL_VIEWPORT);
  const secondExpected = buildViewportGraph(second.seed, INITIAL_VIEWPORT);
  const firstOrigin = firstExpected.nodes[toNodeID(0, 0)];
  const secondOrigin = secondExpected.nodes[toNodeID(0, 0)];

  invariant(firstOrigin, 'the initial viewport always contains its origin cell');
  invariant(secondOrigin, 'the initial viewport always contains its origin cell');

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const hook = renderHook(() => {
      useAvatarRegionGraph();

      return { selection: useSelectedNode(), worldGraph: useWorldGraph() };
    });

    // poll the origin node alone: a full-graph mismatch diff per retry starves the event loop of
    // the query fetch this wait depends on
    await waitFor(() => {
      expect(hook.result.current.worldGraph.nodes[toNodeID(0, 0)]).toStrictEqual(firstOrigin);
    });

    expect(hook.result.current.worldGraph).toStrictEqual(firstExpected);

    const active = db.activeAvatarCollection.findFirst((q) => q.where({ userID: signedIn.userID }));

    invariant(active, 'createActiveAvatar seeds an active-avatar row for this user');

    await db.activeAvatarCollection.update(active, {
      data(record) {
        record.avatarID = second.id;
      },
    });

    await hook.queryClient.invalidateQueries();

    await waitFor(() => {
      expect(hook.result.current.worldGraph.nodes[toNodeID(0, 0)]).toStrictEqual(secondOrigin);
    });

    expect(hook.result.current.worldGraph).toStrictEqual(secondExpected);

    // the origin node's id is '0_0' for every seed, but its jittered position is seed-specific —
    // asserting the node object proves the selection moved to the new avatar's origin
    expect(hook.result.current.selection.node).toStrictEqual(secondOrigin);
  });
});

test('it refreshes the graph without resetting the selection when the viewport moves for the same avatar', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ seed: 555, userID: signedIn.userID });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const hook = renderHook(() => {
      useAvatarRegionGraph();

      return { selection: useSelectedNode(), worldGraph: useWorldGraph() };
    });

    await waitFor(() => {
      expect(hook.result.current.selection.node?.id).toBe(toNodeID(0, 0));
    });

    const movedViewport = { maxCX: 40, maxCY: 10, minCX: 20, minCY: -10 };
    const expectedMovedGraph = buildViewportGraph(avatar.seed, movedViewport);

    setViewport(movedViewport);

    await waitFor(() => {
      expect(hook.result.current.worldGraph).toStrictEqual(expectedMovedGraph);
    });

    expect(hook.result.current.selection.node?.id).toBe(toNodeID(0, 0));
  });
});
