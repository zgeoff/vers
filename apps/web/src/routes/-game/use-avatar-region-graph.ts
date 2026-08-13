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
import type { Viewport } from '@vers/worldmap-core';
import { buildRevealSources, collectSelectableNodeIDs, toNodeID } from '@vers/worldmap-core';
import { useEffect, useRef, useState } from 'react';
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

const EMPTY_NODE_ID_SET: ReadonlySet<string> = new Set();

/**
 * The last resolved completed-node set paired with the avatar it was resolved for, so a held set
 * is never read across an avatar switch.
 */
interface HeldCompletedNodeIDs {
  readonly avatarID: string | undefined;
  readonly nodeIDs: ReadonlySet<string>;
}

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
 * Alongside the graph, every region-touching update recomputes the store's two completed-set
 * projections: the selectable-node set — the origin, every completed node, and every node an edge
 * connects to a completed node, the same reachability rule the activity service gates starts
 * against — over the full topology, never over the viewport-filtered graph edges, so the client
 * and server always agree at a viewport boundary; and the reveal sources the fog-of-war renderer
 * projects the revealed region from. The recompute only runs when the region or the completed set
 * actually changes, not on every cell-granular viewport update the free camera reports while
 * panning.
 *
 * The completed set comes from the avatar's revealed-nodes query, which this hook alone subscribes
 * to. The query stays
 * disabled until the camera reports a viewport and the store's region belongs to the active avatar
 * — a viewport held by another avatar's region is that avatar's camera footprint, and the region
 * switch clears it before the incoming avatar may issue a request. The chunk-aligned viewport
 * keying the query is shrunk to the reveal cell cap so no canvas aspect can produce a request the
 * service would reject. The
 * completed set itself is viewport-independent, but the viewport-carrying key means a pan across a
 * chunk boundary re-keys the query and drops its data back to `undefined` for a moment, so the
 * last resolved set is held in state beside the avatar it belongs to and reused until the new
 * key's fetch lands, rather than collapsing selectability to the origin alone on every such
 * crossing. An avatar switch drops that held set immediately, so the incoming avatar never briefly
 * inherits the outgoing avatar's completed nodes.
 */
export function useAvatarRegionGraph(): void {
  const avatarQuery = useQuery(buildActiveAvatarQueryOptions());
  const avatarID = avatarQuery.data?.id;
  const seed = avatarQuery.data?.seed;
  const viewport = useViewport();
  const regionKey = useRegionKey();
  const previousAvatarIDRef = useRef<string | undefined>(undefined);
  const previousViewportRef = useRef<null | Viewport>(null);
  const previousCompletedNodeIDsRef = useRef<null | ReadonlySet<string>>(null);

  const [heldCompleted, setHeldCompleted] = useState<HeldCompletedNodeIDs>({
    avatarID: undefined,
    nodeIDs: EMPTY_NODE_ID_SET,
  });

  const revealedViewport = viewport
    ? buildChunkAlignedViewport(viewport, REVEAL_VIEWPORT_CELL_CAP)
    : null;

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

    const regionViewport =
      isAvatarSwitch || viewport === null ? INITIAL_VIEWPORT : buildChunkAlignedViewport(viewport);

    const regionUnchanged =
      !isAvatarSwitch && isSameViewport(previousViewportRef.current, regionViewport);

    if (regionUnchanged) {
      if (completedNodeIDs === previousCompletedNodeIDsRef.current) {
        return;
      }

      previousCompletedNodeIDsRef.current = completedNodeIDs;

      setCompletedNodeProjections(
        collectSelectableNodeIDs(seed, completedNodeIDs),
        buildRevealSources(completedNodeIDs),
      );

      return;
    }

    previousViewportRef.current = regionViewport;
    previousCompletedNodeIDsRef.current = completedNodeIDs;

    const worldGraph = buildViewportGraph(seed, regionViewport);
    const originNode = worldGraph.nodes[toNodeID(0, 0)] ?? null;

    setWorldRegion(
      avatarID,
      seed,
      worldGraph,
      originNode,
      collectSelectableNodeIDs(seed, completedNodeIDs),
      buildRevealSources(completedNodeIDs),
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
