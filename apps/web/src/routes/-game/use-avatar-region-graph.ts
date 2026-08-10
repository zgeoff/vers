import { useQuery } from '@tanstack/react-query';
import { buildRegionGraph, setWorldRegion } from '@vers/worldmap-client';
import { toNodeID } from '@vers/worldmap-core';
import { useEffect } from 'react';
import invariant from 'tiny-invariant';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';

/**
 * Ring radius of the lattice region generated around the active avatar's origin.
 */
const REGION_RADIUS = 24;

/**
 * Rebuilds the worldmap store's region from the active avatar's seed whenever the active avatar
 * changes — a fresh avatar or a switch between avatars — and otherwise leaves the region alone
 * across re-renders and remounts. The region is keyed by the avatar id, not the seed: two avatars
 * can share a seed, and a switch between them must still reset the selection. A missing active
 * avatar leaves the store untouched rather than clearing it.
 */
export function useAvatarRegionGraph(): void {
  const avatarQuery = useQuery(buildActiveAvatarQueryOptions());
  const avatarID = avatarQuery.data?.id;
  const seed = avatarQuery.data?.seed;

  useEffect(() => {
    if (avatarID === undefined || seed === undefined) {
      return;
    }

    const worldGraph = buildRegionGraph(seed, REGION_RADIUS);
    const originNode = worldGraph.nodes[toNodeID(0, 0)];

    invariant(originNode, 'the generated region always contains its origin cell');
    setWorldRegion(avatarID, worldGraph, originNode);
  }, [avatarID, seed]);
}
