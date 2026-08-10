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
 * Rebuilds the worldmap store's region from the active avatar's seed whenever it changes — a fresh
 * avatar or a switch between avatars — and otherwise leaves the region alone across re-renders. A
 * missing active avatar leaves the store untouched rather than clearing it.
 */
export function useAvatarRegionGraph(): void {
  const avatarQuery = useQuery(buildActiveAvatarQueryOptions());
  const seed = avatarQuery.data?.seed;

  useEffect(() => {
    if (seed === undefined) {
      return;
    }

    const worldGraph = buildRegionGraph(seed, REGION_RADIUS);
    const originNode = worldGraph.nodes[toNodeID(0, 0)];

    invariant(originNode, 'the generated region always contains its origin cell');
    setWorldRegion(seed, worldGraph, originNode);
  }, [seed]);
}
