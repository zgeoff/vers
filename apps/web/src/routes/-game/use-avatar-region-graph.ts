import { useQuery } from '@tanstack/react-query';
import {
  buildChunkAlignedViewport,
  buildViewportGraph,
  setWorldRegion,
  useViewport,
} from '@vers/worldmap-client';
import type { Viewport } from '@vers/worldmap-core';
import { toNodeID } from '@vers/worldmap-core';
import { useEffect, useRef } from 'react';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';

/**
 * Cell-coordinate box the region graph builds from before the free camera has reported its own
 * viewport — the moment between an avatar loading and the camera's first frame update — and on
 * every avatar switch, so the incoming avatar's origin node is always present to select regardless
 * of where the outgoing avatar had panned the camera.
 */
const INITIAL_VIEWPORT: Viewport = { maxCX: 24, maxCY: 24, minCX: -24, minCY: -24 };

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
 */
export function useAvatarRegionGraph(): void {
  const avatarQuery = useQuery(buildActiveAvatarQueryOptions());
  const avatarID = avatarQuery.data?.id;
  const seed = avatarQuery.data?.seed;
  const viewport = useViewport();
  const previousAvatarIDRef = useRef<string | undefined>(undefined);
  const previousViewportRef = useRef<null | Viewport>(null);

  useEffect(() => {
    if (avatarID === undefined || seed === undefined) {
      return;
    }

    const isAvatarSwitch = previousAvatarIDRef.current !== avatarID;

    previousAvatarIDRef.current = avatarID;

    const regionViewport =
      isAvatarSwitch || viewport === null ? INITIAL_VIEWPORT : buildChunkAlignedViewport(viewport);

    if (!isAvatarSwitch && isSameViewport(previousViewportRef.current, regionViewport)) {
      return;
    }

    previousViewportRef.current = regionViewport;

    const worldGraph = buildViewportGraph(seed, regionViewport);
    const originNode = worldGraph.nodes[toNodeID(0, 0)] ?? null;

    setWorldRegion(avatarID, worldGraph, originNode);
  }, [avatarID, seed, viewport]);
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
