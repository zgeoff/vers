import type { Viewport } from '@vers/worldmap-core';
import { orpc } from '../rpc/orpc';

/**
 * Reveal state changes only when the avatar earns a new first-clear grant, far less often than the
 * player pans — long enough that a re-mount or window refocus doesn't re-fetch a viewport nothing
 * has changed for.
 */
const REVEALED_NODES_STALE_TIME_MS = 30_000;

/**
 * Query options for an avatar's revealed world-map cells inside a viewport. The query key carries
 * both inputs: the avatar id, so no avatar ever reads another's cached reveal data, and the
 * viewport. Callers pass an already chunk-aligned viewport, so for a given avatar the key changes
 * only when the player pans across a chunk boundary rather than on every frame's cell-granular
 * move.
 */
export function buildRevealedNodesQueryOptions(avatarID: string, viewport: Viewport) {
  return orpc.activity.getRevealedNodes.queryOptions({
    input: { avatarID, viewport },
    staleTime: REVEALED_NODES_STALE_TIME_MS,
  });
}
