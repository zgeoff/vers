import { useQuery } from '@tanstack/react-query';
import { useViewport } from '@vers/worldmap-client';
import type { Viewport } from '@vers/worldmap-core';
import { buildRevealedNodesQueryOptions } from '../../lib/activity/build-revealed-nodes-query-options';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';
import { buildChunkAlignedViewport } from './build-chunk-aligned-viewport';

const EMPTY_VIEWPORT: Viewport = { maxCX: 0, maxCY: 0, minCX: 0, minCY: 0 };

/**
 * Subscribes to the avatar's revealed-nodes query for whatever chunk the free camera's viewport
 * currently covers, warming the query cache for the fog-of-war renderer to read; this hook never
 * reads the result itself. Disabled until the camera reports a viewport, since the reveal query has
 * nothing meaningful to bound before then.
 */
export function useRevealedNodesQuery(): void {
  const avatarQuery = useQuery(buildActiveAvatarQueryOptions());
  const avatarID = avatarQuery.data?.id;
  const viewport = useViewport();
  const chunkAlignedViewport = viewport ? buildChunkAlignedViewport(viewport) : null;

  useQuery({
    ...buildRevealedNodesQueryOptions(avatarID ?? '', chunkAlignedViewport ?? EMPTY_VIEWPORT),
    enabled: avatarID !== undefined && chunkAlignedViewport !== null,
  });
}
