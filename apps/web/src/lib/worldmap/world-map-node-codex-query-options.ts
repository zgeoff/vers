import { getWorldMapNodeCodexFragment } from './get-world-map-node-codex-fragment';

/**
 * RSC values need `structuralSharing: false`: Query's default deep-equality check can't run over
 * a Composite Component source.
 */
export function worldMapNodeCodexQueryOptions(difficulty: number) {
  return {
    queryFn: () => getWorldMapNodeCodexFragment({ data: { difficulty } }),
    queryKey: ['rsc', 'world-map-node-codex', difficulty],
    structuralSharing: false,
  };
}
