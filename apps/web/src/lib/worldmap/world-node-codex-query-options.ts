import { getWorldNodeCodexFragment } from './get-world-node-codex-fragment';

/**
 * RSC values need `structuralSharing: false`: Query's default deep-equality check can't run over
 * a Composite Component source.
 */
export function worldNodeCodexQueryOptions(difficulty: number) {
  return {
    queryFn: () => getWorldNodeCodexFragment({ data: { difficulty } }),
    queryKey: ['rsc', 'world-node-codex', difficulty],
    structuralSharing: false,
  };
}
