import type { Viewport } from '@vers/worldmap-core';
import { orpc } from '../rpc/orpc';

const REVEALED_NODES_STALE_TIME_MS = 30_000;

export function buildRevealedNodesQueryOptions(avatarID: string, viewport: Viewport) {
  return orpc.activity.getRevealedNodes.queryOptions({
    input: { avatarID, viewport },
    staleTime: REVEALED_NODES_STALE_TIME_MS,
  });
}
