import { expect, mock, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import {
  buildChunkAlignedViewport,
  buildViewportGraph,
  setViewport,
  useRevealSources,
  useSelectableNodeIDs,
  useSelectedNode,
  useViewport,
  useWorldGraph,
} from '@vers/worldmap-client';
import { REVEAL_RADIUS, collectNodeEdges, toNodeID } from '@vers/worldmap-core';
import invariant from 'tiny-invariant';
import { server } from '../../mocks/node';
import { createActiveAvatar } from '../../test-utils/create-active-avatar';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { renderHook } from '../../test-utils/render-hook';
import { withRequestContext } from '../../test-utils/with-request-context';
import { useAvatarRegionGraph } from './use-avatar-region-graph';

test("it builds the active avatar's region graph and selects its origin node", async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ seed: 111, userID: signedIn.userID });

  const expected = buildViewportGraph(avatar.seed, {
    maxCX: 24,
    maxCY: 24,
    minCX: -24,
    minCY: -24,
  });

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
    expect(hook.result.current.selection.node).toMatchObject({ id: toNodeID(0, 0) });
  });
});

test('it rebuilds the graph and resets the selection when the active avatar changes', async () => {
  const signedIn = await createSignedInUser();
  const first = await createActiveAvatar({ seed: 333, userID: signedIn.userID });
  const second = await db.avatarCollection.create({ seed: 444, userID: signedIn.userID });

  const firstExpected = buildViewportGraph(first.seed, {
    maxCX: 24,
    maxCY: 24,
    minCX: -24,
    minCY: -24,
  });

  const secondExpected = buildViewportGraph(second.seed, {
    maxCX: 24,
    maxCY: 24,
    minCX: -24,
    minCY: -24,
  });

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
      expect(hook.result.current.selection.node).toMatchObject({ id: toNodeID(0, 0) });
    });

    const movedViewport = { maxCX: 40, maxCY: 10, minCX: 20, minCY: -10 };

    const expectedMovedGraph = buildViewportGraph(
      avatar.seed,
      buildChunkAlignedViewport(movedViewport),
    );

    const probeID = toNodeID(40, 10);
    const expectedProbeNode = expectedMovedGraph.nodes[probeID];

    invariant(expectedProbeNode, 'the aligned moved viewport contains its own upper corner cell');
    setViewport(movedViewport);

    // poll one moved-viewport node alone: a full-graph mismatch diff per retry starves the event
    // loop of the query fetch this wait depends on
    await waitFor(() => {
      expect(hook.result.current.worldGraph.nodes[probeID]).toStrictEqual(expectedProbeNode);
    });

    expect(hook.result.current.worldGraph).toStrictEqual(expectedMovedGraph);
    expect(hook.result.current.selection.node).toMatchObject({ id: toNodeID(0, 0) });
  });
});

test('it keeps the same graph across a viewport move inside the same chunks', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ seed: 666, userID: signedIn.userID });

  const expectedInitialOrigin = buildViewportGraph(avatar.seed, {
    maxCX: 24,
    maxCY: 24,
    minCX: -24,
    minCY: -24,
  }).nodes[toNodeID(0, 0)];

  invariant(expectedInitialOrigin, 'the initial viewport always contains its origin cell');

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const hook = renderHook(() => {
      useAvatarRegionGraph();

      return { viewport: useViewport(), worldGraph: useWorldGraph() };
    });

    // poll this avatar's seed-specific origin: its region build resets the stored viewport, so a
    // camera viewport set before that build lands would be wiped by it
    await waitFor(() => {
      expect(hook.result.current.worldGraph.nodes[toNodeID(0, 0)]).toStrictEqual(
        expectedInitialOrigin,
      );
    });

    const firstViewport = { maxCX: 5, maxCY: 5, minCX: 1, minCY: 1 };

    const expectedAlignedGraph = buildViewportGraph(
      avatar.seed,
      buildChunkAlignedViewport(firstViewport),
    );

    setViewport(firstViewport);

    // poll for a cell the aligned box excludes to observe the rebuild: the aligned graph's own
    // nodes also all sit inside the wider initial region, so only an absence distinguishes it
    await waitFor(() => {
      expect(hook.result.current.worldGraph.nodes[toNodeID(-1, 0)]).toBeUndefined();
    });

    expect(hook.result.current.worldGraph).toStrictEqual(expectedAlignedGraph);

    const stableGraph = hook.result.current.worldGraph;
    const secondViewport = { maxCX: 9, maxCY: 9, minCX: 3, minCY: 3 };

    setViewport(secondViewport);

    await waitFor(() => {
      expect(hook.result.current.viewport).toStrictEqual(secondViewport);
    });

    expect(hook.result.current.worldGraph).toBe(stableGraph);
  });
});

test('it selects the new origin on an avatar switch even when the viewport had panned far from it', async () => {
  const signedIn = await createSignedInUser();

  await createActiveAvatar({ seed: 333, userID: signedIn.userID });

  const second = await db.avatarCollection.create({ seed: 444, userID: signedIn.userID });

  const secondExpected = buildViewportGraph(second.seed, {
    maxCX: 24,
    maxCY: 24,
    minCX: -24,
    minCY: -24,
  });

  const secondOrigin = secondExpected.nodes[toNodeID(0, 0)];

  invariant(secondOrigin, 'the initial viewport always contains its origin cell');

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const hook = renderHook(() => {
      useAvatarRegionGraph();

      return { selection: useSelectedNode(), viewport: useViewport(), worldGraph: useWorldGraph() };
    });

    await waitFor(() => {
      expect(hook.result.current.selection.node).toMatchObject({ id: toNodeID(0, 0) });
    });

    const farViewport = { maxCX: 800, maxCY: 800, minCX: 760, minCY: 760 };

    setViewport(farViewport);

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

    expect(hook.result.current.selection.node).toStrictEqual(secondOrigin);

    // the switch also clears the outgoing avatar's camera footprint, so nothing can query the new
    // avatar with the far-panned coordinates before the camera reports a fresh viewport
    expect(hook.result.current.viewport).toBeNull();
  });
});

test('it queries revealed nodes for a chunk-aligned, cap-shrunk viewport once the camera reports one', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.getRevealedNodes.handler((opts) => {
      track(opts.input);

      return { completedNodeIDs: [], contentVersion: 'v1', nodes: [] };
    }),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const hook = renderHook(() => {
      useAvatarRegionGraph();

      return { selection: useSelectedNode() };
    });

    // the mount's own region build resets the stored viewport, so the camera viewport that enables
    // the revealed-nodes query is set only once the selection settles
    await waitFor(() => {
      expect(hook.result.current.selection.node).toMatchObject({ id: toNodeID(0, 0) });
    });

    setViewport({ maxCX: 17, maxCY: 20, minCX: 1, minCY: -1 });

    await waitFor(() => {
      expect(track).toHaveBeenCalledExactlyOnceWith({
        avatarID: avatar.id,
        viewport: { maxCX: 31, maxCY: 31, minCX: 0, minCY: -16 },
      });
    });
  });
});

test('it queries no revealed nodes before the camera has reported a viewport', async () => {
  const signedIn = await createSignedInUser();

  await createActiveAvatar({ userID: signedIn.userID });

  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.getRevealedNodes.handler((opts) => {
      track(opts.input);

      return { completedNodeIDs: [], contentVersion: 'v1', nodes: [] };
    }),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const hook = renderHook(() => {
      useAvatarRegionGraph();

      return { selection: useSelectedNode() };
    });

    // the settled selection proves the region build ran, the window a would-be-enabled reveal
    // query had to fire in
    await waitFor(() => {
      expect(hook.result.current.selection.node).toMatchObject({ id: toNodeID(0, 0) });
    });

    expect(track).not.toHaveBeenCalled();
  });
});

test('it limits the selectable set to the origin while the avatar holds no completed nodes', async () => {
  const signedIn = await createSignedInUser();

  await createActiveAvatar({ seed: 777, userID: signedIn.userID });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const hook = renderHook(() => {
      useAvatarRegionGraph();

      return { selectable: useSelectableNodeIDs() };
    });

    await waitFor(() => {
      expect(hook.result.current.selectable).toStrictEqual(new Set([toNodeID(0, 0)]));
    });
  });
});

test('it extends the selectable set to a real neighbour once the revealed-nodes query resolves a completed grant', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ seed: 888, userID: signedIn.userID });

  const originID = toNodeID(0, 0);
  const [edge] = collectNodeEdges(avatar.seed, 0, 0);

  invariant(edge, 'the origin connects to at least one neighbour');

  const [aID = '', bID = ''] = edge.id.split('|');
  const neighbourID = aID === originID ? bID : aID;

  server.use(
    mockActivityService.getRevealedNodes.handler(() => ({
      completedNodeIDs: [originID],
      contentVersion: 'v1',
      nodes: [],
    })),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const hook = renderHook(() => {
      useAvatarRegionGraph();

      return { selectable: useSelectableNodeIDs() };
    });

    // the mount's own region build resets the stored viewport, so the camera viewport that
    // enables the revealed-nodes query is set only once that settles
    await waitFor(() => {
      expect(hook.result.current.selectable).toStrictEqual(new Set([originID]));
    });

    setViewport({ maxCX: 5, maxCY: 5, minCX: -5, minCY: -5 });

    await waitFor(() => {
      expect(hook.result.current.selectable.has(neighbourID)).toBe(true);
    });
  });
});

test('it publishes the origin reveal disc on the region build and extends it once the revealed-nodes query resolves a completed grant', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ seed: 1212, userID: signedIn.userID });

  const expectedOrigin = buildViewportGraph(avatar.seed, {
    maxCX: 24,
    maxCY: 24,
    minCX: -24,
    minCY: -24,
  }).nodes[toNodeID(0, 0)];

  invariant(expectedOrigin, 'the initial viewport always contains its origin cell');

  server.use(
    mockActivityService.getRevealedNodes.handler(() => ({
      completedNodeIDs: ['1_0'],
      contentVersion: 'v1',
      nodes: [],
    })),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const hook = renderHook(() => {
      useAvatarRegionGraph();

      return { revealSources: useRevealSources(), worldGraph: useWorldGraph() };
    });

    // poll this avatar's seed-specific origin: the region build resets the stored viewport, so a
    // camera viewport set before that build lands would be wiped by it
    await waitFor(() => {
      expect(hook.result.current.worldGraph.nodes[toNodeID(0, 0)]).toStrictEqual(expectedOrigin);
    });

    // the region build publishes the origin disc before any query resolves, so a fresh avatar sees
    // its starting area instead of a fully fogged map
    expect(hook.result.current.revealSources).toStrictEqual([
      { coord: [0, 0], radius: REVEAL_RADIUS },
    ]);

    setViewport({ maxCX: 5, maxCY: 5, minCX: -5, minCY: -5 });

    await waitFor(() => {
      expect(hook.result.current.revealSources).toStrictEqual([
        { coord: [0, 0], radius: REVEAL_RADIUS },
        { coord: [1, 0], radius: REVEAL_RADIUS },
      ]);
    });
  });
});

test("it keeps a completed node's neighbour selectable while a chunk-crossing pan re-keys the revealed-nodes query", async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ seed: 999, userID: signedIn.userID });

  const originID = toNodeID(0, 0);
  const [edge] = collectNodeEdges(avatar.seed, 0, 0);

  invariant(edge, 'the origin connects to at least one neighbour');

  const [aID = '', bID = ''] = edge.id.split('|');
  const neighbourID = aID === originID ? bID : aID;
  let fetchCount = 0;
  let resolveSecondFetch: (() => void) | undefined;

  server.use(
    mockActivityService.getRevealedNodes.handler(async () => {
      fetchCount += 1;

      if (fetchCount === 2) {
        await new Promise<void>((resolve) => {
          resolveSecondFetch = resolve;
        });
      }

      return { completedNodeIDs: [originID], contentVersion: 'v1', nodes: [] };
    }),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const hook = renderHook(() => {
      useAvatarRegionGraph();

      return { selectable: useSelectableNodeIDs() };
    });

    // the mount's own region build resets the stored viewport, so the camera viewport that enables
    // the revealed-nodes query is set only once that settles
    await waitFor(() => {
      expect(hook.result.current.selectable).toStrictEqual(new Set([originID]));
    });

    setViewport({ maxCX: 5, maxCY: 5, minCX: -5, minCY: -5 });

    await waitFor(() => {
      expect(hook.result.current.selectable.has(neighbourID)).toBe(true);
    });

    // a chunk-crossing pan re-keys the revealed-nodes query into a fresh, unresolved fetch, dropping
    // its data back to undefined
    setViewport({ maxCX: 40, maxCY: 5, minCX: 30, minCY: -5 });

    await waitFor(() => {
      expect(fetchCount).toBe(2);
    });

    // the held completed set keeps the previously resolved ids alive while the re-keyed query's
    // data is still undefined, so the neighbour must not drop back out of the selectable set here
    expect(hook.result.current.selectable.has(neighbourID)).toBe(true);

    invariant(resolveSecondFetch, 'the chunk-crossing pan started the second fetch');
    resolveSecondFetch();

    // the resolved fetch settles the re-keyed query in place: no further round trip fires and the
    // neighbour stays selectable
    await waitFor(() => {
      expect(hook.queryClient.isFetching()).toBe(0);
    });

    expect(fetchCount).toBe(2);
    expect(hook.result.current.selectable.has(neighbourID)).toBe(true);
  });
});

test('it returns the fog-revealed node id set, growing it once a completed grant extends the reveal disc', async () => {
  const signedIn = await createSignedInUser();

  await createActiveAvatar({ seed: 1313, userID: signedIn.userID });

  // a completed node far outside the origin's reveal disc, so only its own disc can reveal its
  // cell — exercising the growth path rather than a cell the origin disc already covers
  const completedID = toNodeID(6, 0);

  server.use(
    mockActivityService.getRevealedNodes.handler(() => ({
      completedNodeIDs: [completedID],
      contentVersion: 'v1',
      nodes: [],
    })),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const hook = renderHook(() => useAvatarRegionGraph());

    // the origin disc is published on the region build, but the far node's cell sits well beyond it
    // until the revealed-nodes query resolves the grant and adds its disc
    await waitFor(() => {
      expect(hook.result.current.has(toNodeID(0, 0))).toBe(true);
    });

    expect(hook.result.current.has(completedID)).toBe(false);

    setViewport({ maxCX: 20, maxCY: 20, minCX: -20, minCY: -20 });

    await waitFor(() => {
      expect(hook.result.current.has(completedID)).toBe(true);
    });
  });
});

test("it drops the selectable set to origin-only on an avatar switch, not carrying the outgoing avatar's completed neighbours", async () => {
  const signedIn = await createSignedInUser();
  const first = await createActiveAvatar({ seed: 123, userID: signedIn.userID });
  const second = await db.avatarCollection.create({ seed: 456, userID: signedIn.userID });

  const originID = toNodeID(0, 0);
  const [edge] = collectNodeEdges(first.seed, 0, 0);

  invariant(edge, 'the origin connects to at least one neighbour');

  const [aID = '', bID = ''] = edge.id.split('|');
  const firstNeighbourID = aID === originID ? bID : aID;
  const requestedAvatarIDs: Array<string> = [];

  server.use(
    mockActivityService.getRevealedNodes.handler((opts) => {
      requestedAvatarIDs.push(opts.input.avatarID);

      return {
        completedNodeIDs: [originID],
        contentVersion: 'v1',
        nodes: [],
      };
    }),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const hook = renderHook(() => {
      useAvatarRegionGraph();

      return { selectable: useSelectableNodeIDs(), viewport: useViewport() };
    });

    // the mount's own region build resets the stored viewport, so the camera viewport that enables
    // the revealed-nodes query is set only once that settles
    await waitFor(() => {
      expect(hook.result.current.selectable).toStrictEqual(new Set([originID]));
    });

    setViewport({ maxCX: 5, maxCY: 5, minCX: -5, minCY: -5 });

    await waitFor(() => {
      expect(hook.result.current.selectable.has(firstNeighbourID)).toBe(true);
    });

    const active = db.activeAvatarCollection.findFirst((q) => q.where({ userID: signedIn.userID }));

    invariant(active, 'createActiveAvatar seeds an active-avatar row for this user');

    await db.activeAvatarCollection.update(active, {
      data(record) {
        record.avatarID = second.id;
      },
    });

    await hook.queryClient.invalidateQueries();

    // the switch resets the store's viewport to null, so the revealed-nodes query for the incoming
    // avatar stays disabled and can never resolve a completed set of its own during this assertion
    await waitFor(() => {
      expect(hook.result.current.viewport).toBeNull();
    });

    expect(hook.result.current.selectable).toStrictEqual(new Set([originID]));
    expect(hook.result.current.selectable.has(firstNeighbourID)).toBe(false);

    // the query stays gated on the store's region key, so the render window between the avatar
    // flipping and the region switch committing never sends a request for the incoming avatar at
    // the outgoing avatar's camera footprint
    expect(requestedAvatarIDs).not.toContain(second.id);
  });
});

test("it returns an empty frontier through an avatar switch, never the outgoing avatar's revealed nodes", async () => {
  const signedIn = await createSignedInUser();
  const first = await createActiveAvatar({ seed: 123, userID: signedIn.userID });
  const second = await db.avatarCollection.create({ seed: 456, userID: signedIn.userID });

  // a far completed node grows the first avatar's frontier to a cell the second avatar's
  // origin-only frontier never covers, so the cell distinguishes the two avatars' frontiers
  const firstOnlyID = toNodeID(6, 0);

  server.use(
    mockActivityService.getRevealedNodes.handler((opts) => ({
      completedNodeIDs: opts.input.avatarID === first.id ? [firstOnlyID] : [],
      contentVersion: 'v1',
      nodes: [],
    })),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const frontiers: Array<ReadonlySet<string>> = [];

    const hook = renderHook(() => {
      const revealed = useAvatarRegionGraph();

      frontiers.push(revealed);

      return revealed;
    });

    await waitFor(() => {
      expect(hook.result.current.has(toNodeID(0, 0))).toBe(true);
    });

    setViewport({ maxCX: 20, maxCY: 20, minCX: -20, minCY: -20 });

    await waitFor(() => {
      expect(hook.result.current.has(firstOnlyID)).toBe(true);
    });

    const active = db.activeAvatarCollection.findFirst((q) => q.where({ userID: signedIn.userID }));

    invariant(active, 'createActiveAvatar seeds an active-avatar row for this user');

    await db.activeAvatarCollection.update(active, {
      data(record) {
        record.avatarID = second.id;
      },
    });

    frontiers.length = 0;

    await hook.queryClient.invalidateQueries();

    await waitFor(() => {
      expect(hook.result.current.has(toNodeID(0, 0))).toBe(true);
    });

    // the incoming avatar settles to its own origin-only frontier
    expect(hook.result.current.has(firstOnlyID)).toBe(false);

    // the transition render returns an empty set rather than the outgoing avatar's held frontier,
    // so the far cell never appears under the incoming avatar while the switch commits
    expect(frontiers.some((frontier) => frontier.size === 0)).toBe(true);
    expect(frontiers.some((frontier) => frontier.has(firstOnlyID))).toBe(false);
  });
});
