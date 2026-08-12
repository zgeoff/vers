import { useQuery } from '@tanstack/react-query';
import { REVEAL_VIEWPORT_CELL_CAP } from '@vers/contract-activity';
import {
  buildChunkAlignedViewport,
  buildViewportGraph,
  setSelectableNodeIDs,
  setWorldRegion,
  useViewport,
} from '@vers/worldmap-client';
import type { Viewport } from '@vers/worldmap-core';
import { collectNodeEdges, findCellCoord, toNodeID } from '@vers/worldmap-core';
import { useEffect, useRef } from 'react';
import { buildRevealedNodesQueryOptions } from '../../lib/activity/build-revealed-nodes-query-options';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';

/**
 * Cell-coordinate box the region graph builds from before the free camera has reported its own
 * viewport — the moment between an avatar loading and the camera's first frame update — and on
 * every avatar switch, so the incoming avatar's origin node is always present to select regardless
 * of where the outgoing avatar had panned the camera.
 */
const INITIAL_VIEWPORT: Viewport = { maxCX: 24, maxCY: 24, minCX: -24, minCY: -24 };
const EMPTY_VIEWPORT: Viewport = { maxCX: 0, maxCY: 0, minCX: 0, minCY: 0 };

/**
 * Rebuilds the worldmap store's region graph from the active avatar's seed and the store's current
 * viewport, and resets the selection and viewport to the avatar's origin whenever the active
 * avatar itself changes — a fresh avatar or a switch between avatars — while otherwise leaving the
 * selection alone across a moved viewport, a re-render, or a remount. The graph is built from the
 * chunk-aligned viewport and kept by reference while that alignment holds, so the rendered node
 * and edge lists change only when a pan crosses a chunk boundary, not on every cell-granular
 * camera move. The region is keyed by the avatar id, not the seed: two avatars can share a seed,
 * and a switch between them must still reset the selection. A missing active avatar leaves the
 * store untouched rather than clearing it.
 *
 * Alongside the graph, every region-touching update recomputes the store's selectable-node set by
 * expanding one hop out from the origin and each completed node — the same reachability rule
 * `startActivity` gates against — over the full topology, never over the viewport-filtered graph
 * edges, so the client and server always agree at a viewport boundary. The completed set comes from
 * the avatar's revealed-nodes query, already warmed by `useRevealedNodesQuery`, and is
 * viewport-independent: since the query key still carries the chunk-aligned viewport, a pan across a
 * chunk boundary re-keys the query and drops its data back to `undefined` for a moment, so the last
 * resolved completed set is held in a ref and reused until the new key's fetch lands, rather than
 * collapsing selectability to the origin alone on every such crossing. An avatar switch clears that
 * held set immediately, so the incoming avatar never briefly inherits the outgoing avatar's completed
 * nodes. The selectable-set recompute itself only runs when the region or the completed set actually
 * changes, not on every cell-granular viewport update the free camera reports while panning.
 */
export function useAvatarRegionGraph(): void {
  const avatarQuery = useQuery(buildActiveAvatarQueryOptions());
  const avatarID = avatarQuery.data?.id;
  const seed = avatarQuery.data?.seed;
  const viewport = useViewport();
  const previousAvatarIDRef = useRef<string | undefined>(undefined);
  const previousViewportRef = useRef<null | Viewport>(null);
  const previousCompletedNodeIDsRef = useRef<null | ReadonlySet<string>>(null);
  const completedNodeIDsRef = useRef<ReadonlySet<string>>(new Set());
  const completedNodeIDsAvatarRef = useRef<string | undefined>(undefined);

  const revealedViewport = viewport
    ? buildChunkAlignedViewport(viewport, REVEAL_VIEWPORT_CELL_CAP)
    : null;

  const revealedNodesQuery = useQuery({
    ...buildRevealedNodesQueryOptions(avatarID ?? '', revealedViewport ?? EMPTY_VIEWPORT),
    enabled: avatarID !== undefined && revealedViewport !== null,
  });

  if (completedNodeIDsAvatarRef.current !== avatarID) {
    completedNodeIDsAvatarRef.current = avatarID;

    completedNodeIDsRef.current = new Set();
  }

  if (revealedNodesQuery.data?.completedNodeIDs !== undefined) {
    const resolvedCompletedNodeIDs = new Set(revealedNodesQuery.data.completedNodeIDs);

    if (!isSameNodeIDSet(completedNodeIDsRef.current, resolvedCompletedNodeIDs)) {
      completedNodeIDsRef.current = resolvedCompletedNodeIDs;
    }
  }

  const completedNodeIDs = completedNodeIDsRef.current;

  useEffect(() => {
    if (avatarID === undefined || seed === undefined) {
      return;
    }

    const isAvatarSwitch = previousAvatarIDRef.current !== avatarID;

    previousAvatarIDRef.current = avatarID;

    const regionViewport =
      isAvatarSwitch || viewport === null ? INITIAL_VIEWPORT : buildChunkAlignedViewport(viewport);

    const regionUnchanged =
      !isAvatarSwitch && isSameViewport(previousViewportRef.current, regionViewport);

    if (regionUnchanged) {
      if (completedNodeIDs === previousCompletedNodeIDsRef.current) {
        return;
      }

      previousCompletedNodeIDsRef.current = completedNodeIDs;

      setSelectableNodeIDs(buildSelectableNodeIDs(seed, completedNodeIDs));

      return;
    }

    previousViewportRef.current = regionViewport;
    previousCompletedNodeIDsRef.current = completedNodeIDs;

    const worldGraph = buildViewportGraph(seed, regionViewport);
    const originNode = worldGraph.nodes[toNodeID(0, 0)] ?? null;

    setWorldRegion(
      avatarID,
      worldGraph,
      originNode,
      buildSelectableNodeIDs(seed, completedNodeIDs),
    );
  }, [avatarID, seed, viewport, completedNodeIDs]);
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

/**
 * Expands the avatar's selectable-node set one hop out from each completed node, plus the origin
 * itself — `collectNodeEdges` per completed node against the full topology, O(completed ×
 * edges-per-node) — rather than testing every node in a rendered region against the completed set.
 * The origin joins the result unconditionally but is never itself an expansion source, matching
 * `isNodeSelectable`: an uncompleted origin makes only the origin selectable, not its neighbours.
 */
function buildSelectableNodeIDs(
  seed: number,
  completedNodeIDs: ReadonlySet<string>,
): ReadonlySet<string> {
  const selectable = new Set<string>([...completedNodeIDs, toNodeID(0, 0)]);

  for (const nodeID of completedNodeIDs) {
    const coord = findCellCoord(nodeID);

    if (coord === undefined) {
      continue;
    }

    for (const edge of collectNodeEdges(seed, coord[0], coord[1])) {
      const [aID = '', bID = ''] = edge.id.split('|');
      const neighbourID = aID === nodeID ? bID : aID;

      selectable.add(neighbourID);
    }
  }

  return selectable;
}
