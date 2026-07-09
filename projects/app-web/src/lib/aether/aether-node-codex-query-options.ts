import { getAetherNodeCodexFragment } from './get-aether-node-codex-fragment';

/**
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
