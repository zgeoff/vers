import { useQuery } from '@tanstack/react-query';
import { buildViewportGraph, setWorldRegion, useViewport } from '@vers/worldmap-client';
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
 * viewport, and resets the selection to the avatar's origin whenever the active avatar itself
 * changes — a fresh avatar or a switch between avatars — while otherwise leaving the selection
 * alone across a moved viewport, a re-render, or a remount. The region is keyed by the avatar id,
 * not the seed: two avatars can share a seed, and a switch between them must still reset the
 * selection. A missing active avatar leaves the store untouched rather than clearing it.
 */
export function useAvatarRegionGraph(): void {
  const avatarQuery = useQuery(buildActiveAvatarQueryOptions());
  const avatarID = avatarQuery.data?.id;
  const seed = avatarQuery.data?.seed;
  const viewport = useViewport();
  const previousAvatarIDRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (avatarID === undefined || seed === undefined) {
      return;
    }

    const isAvatarSwitch = previousAvatarIDRef.current !== avatarID;

    previousAvatarIDRef.current = avatarID;

    const regionViewport = isAvatarSwitch ? INITIAL_VIEWPORT : (viewport ?? INITIAL_VIEWPORT);
    const worldGraph = buildViewportGraph(seed, regionViewport);
    const originNode = worldGraph.nodes[toNodeID(0, 0)] ?? null;

    setWorldRegion(avatarID, worldGraph, originNode);
  }, [avatarID, seed, viewport]);
}
