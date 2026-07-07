import { getAetherNodeCodexFragment } from './get-aether-node-codex-fragment';

/**
 * Query options for one node's codex fragment, keyed by difficulty so each distinct node's lore
 * gets its own cache entry — same shared-cache shape as the index route's session-badge fragment.
 * RSC values need `structuralSharing: false`: Query's default deep-equality check can't run over
 * a Composite Component source.
 */
export function aetherNodeCodexQueryOptions(difficulty: number) {
  return {
    queryFn: () => getAetherNodeCodexFragment({ data: { difficulty } }),
    queryKey: ['rsc', 'aether-node-codex', difficulty],
    structuralSharing: false,
  };
}
