import { useQuery } from '@tanstack/react-query';
import { REVEAL_VIEWPORT_CELL_CAP } from '@vers/contract-activity';
import {
  buildChunkAlignedViewport,
  buildViewportGraph,
  setCompletedNodeProjections,
  setWorldRegion,
  useRegionKey,
  useViewport,
} from '@vers/worldmap-client';
import type { RevealSource, Viewport } from '@vers/worldmap-core';
import {
  buildRevealSources,
  collectRevealedCells,
  collectSelectableNodeIDs,
  decodeMortonKey,
  toNodeID,
} from '@vers/worldmap-core';
import { useEffect, useRef, useState } from 'react';
import { buildRevealedNodesQueryOptions } from '../../lib/activity/build-revealed-nodes-query-options';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';
import { useOfflineClearedNodeIDs } from './use-offline-cleared-node-ids';

const INITIAL_VIEWPORT: Viewport = { maxCX: 24, maxCY: 24, minCX: -24, minCY: -24 };
const EMPTY_VIEWPORT: Viewport = { maxCX: 0, maxCY: 0, minCX: 0, minCY: 0 };

const EMPTY_NODE_ID_SET: ReadonlySet<string> = new Set();

interface HeldCompletedNodeIDs {
  readonly avatarID: string | undefined;
  readonly nodeIDs: ReadonlySet<string>;
}

export function useAvatarRegionGraph(): ReadonlySet<string> {
  const avatarQuery = useQuery(buildActiveAvatarQueryOptions());
  const avatarID = avatarQuery.data?.id;
  const seed = avatarQuery.data?.seed;
  const viewport = useViewport();
  const regionKey = useRegionKey();
  const optimisticClearedNodeIDs = useOfflineClearedNodeIDs(avatarID);
  const previousAvatarIDRef = useRef<string | undefined>(undefined);
  const previousViewportRef = useRef<null | Viewport>(null);
  const previousCompletedNodeIDsRef = useRef<null | ReadonlySet<string>>(null);
  const previousOptimisticClearedNodeIDsRef = useRef<null | ReadonlySet<string>>(null);

  // the completed set is viewport-independent, but the viewport-carrying query key re-keys the
  // query on a chunk crossing and drops its data to `undefined` for a moment; the last resolved set
  // is held beside its avatar until the new fetch lands. An avatar switch drops it immediately.
  const [heldCompleted, setHeldCompleted] = useState<HeldCompletedNodeIDs>({
    avatarID: undefined,
    nodeIDs: EMPTY_NODE_ID_SET,
  });

  const [revealedNodeIDs, setRevealedNodeIDs] = useState<ReadonlySet<string>>(EMPTY_NODE_ID_SET);

  // The chunk-aligned viewport keying the query is shrunk to the reveal cell cap so no canvas
  // aspect can produce a request the service would reject.
  const revealedViewport = viewport
    ? buildChunkAlignedViewport(viewport, REVEAL_VIEWPORT_CELL_CAP)
    : null;

  // the sole subscriber to the avatar's revealed-nodes query. Disabled until the camera reports a
  // viewport and the store's region belongs to the active avatar: a viewport held by another
  // avatar's region is that avatar's camera footprint, and the region switch clears it first.
  const revealedNodesQuery = useQuery({
    ...buildRevealedNodesQueryOptions(avatarID ?? '', revealedViewport ?? EMPTY_VIEWPORT),
    enabled: avatarID !== undefined && revealedViewport !== null && regionKey === avatarID,
  });

  const resolvedNodeIDs = revealedNodesQuery.data?.completedNodeIDs;

  let completedNodeIDs =
    heldCompleted.avatarID === avatarID ? heldCompleted.nodeIDs : EMPTY_NODE_ID_SET;

  if (resolvedNodeIDs !== undefined) {
    const resolved = new Set(resolvedNodeIDs);

    if (!isSameNodeIDSet(completedNodeIDs, resolved)) {
      completedNodeIDs = resolved;
    }
  }

  // adjust-state-during-render: storing the effective set beside its avatar makes React rerun the
  // render with the new state before committing, so the held set changes without a ref mutation
  if (heldCompleted.avatarID !== avatarID || heldCompleted.nodeIDs !== completedNodeIDs) {
    setHeldCompleted({ avatarID, nodeIDs: completedNodeIDs });
  }

  useEffect(() => {
    if (avatarID === undefined || seed === undefined) {
      return;
    }

    const isAvatarSwitch = previousAvatarIDRef.current !== avatarID;

    previousAvatarIDRef.current = avatarID;

    // The region rebuilds from the chunk-aligned viewport and is kept by reference while that
    // alignment holds, so the rendered node and edge lists change only when a pan crosses a chunk
    // boundary, not on every cell-granular camera move.
    const regionViewport =
      isAvatarSwitch || viewport === null ? INITIAL_VIEWPORT : buildChunkAlignedViewport(viewport);

    const regionUnchanged =
      !isAvatarSwitch && isSameViewport(previousViewportRef.current, regionViewport);

    // When the region itself hasn't moved, only recompute the completed-set projections, and only
    // when the completed set or the optimistic-cleared set actually changed — not on every
    // cell-granular viewport update the free camera reports while panning.
    if (regionUnchanged) {
      if (
        completedNodeIDs === previousCompletedNodeIDsRef.current &&
        optimisticClearedNodeIDs === previousOptimisticClearedNodeIDsRef.current
      ) {
        return;
      }

      previousCompletedNodeIDsRef.current = completedNodeIDs;
      previousOptimisticClearedNodeIDsRef.current = optimisticClearedNodeIDs;

      const sources = buildRevealSources(completedNodeIDs);
      const selectableSource = buildSelectableSource(completedNodeIDs, optimisticClearedNodeIDs);

      setCompletedNodeProjections(collectSelectableNodeIDs(seed, selectableSource), sources);
      setRevealedNodeIDs(collectRevealedNodeIDs(sources, regionViewport));

      return;
    }

    previousViewportRef.current = regionViewport;
    previousCompletedNodeIDsRef.current = completedNodeIDs;
    previousOptimisticClearedNodeIDsRef.current = optimisticClearedNodeIDs;

    const worldGraph = buildViewportGraph(seed, regionViewport);
    const originNode = worldGraph.nodes[toNodeID(0, 0)] ?? null;
    const sources = buildRevealSources(completedNodeIDs);
    const selectableSource = buildSelectableSource(completedNodeIDs, optimisticClearedNodeIDs);

    setWorldRegion(
      avatarID,
      seed,
      worldGraph,
      originNode,
      collectSelectableNodeIDs(seed, selectableSource),
      sources,
    );

    setRevealedNodeIDs(collectRevealedNodeIDs(sources, regionViewport));
  }, [avatarID, seed, viewport, completedNodeIDs, optimisticClearedNodeIDs]);

  // the frontier state still holds the outgoing avatar's nodes until the effect republishes for the
  // incoming avatar; gating on the projection's avatar keeps a switch from prefetching the wrong
  // avatar's coordinates during the transition render
  return avatarID === previousAvatarIDRef.current ? revealedNodeIDs : EMPTY_NODE_ID_SET;
}

function isSameNodeIDSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }

  for (const id of a) {
    if (!b.has(id)) {
      return false;
    }
  }

  return true;
}

function isSameViewport(previous: null | Viewport, next: Viewport): boolean {
  return (
    previous !== null &&
    previous.minCX === next.minCX &&
    previous.maxCX === next.maxCX &&
    previous.minCY === next.minCY &&
    previous.maxCY === next.maxCY
  );
}

function buildSelectableSource(
  completedNodeIDs: ReadonlySet<string>,
  optimisticClearedNodeIDs: ReadonlySet<string>,
): ReadonlySet<string> {
  return optimisticClearedNodeIDs.size === 0
    ? completedNodeIDs
    : new Set([...completedNodeIDs, ...optimisticClearedNodeIDs]);
}

function collectRevealedNodeIDs(
  sources: ReadonlyArray<RevealSource>,
  viewport: Viewport,
): ReadonlySet<string> {
  const nodeIDs = new Set<string>();

  for (const key of collectRevealedCells(sources, viewport)) {
    const [cx, cy] = decodeMortonKey(key);

    nodeIDs.add(toNodeID(cx, cy));
  }

  return nodeIDs;
}
