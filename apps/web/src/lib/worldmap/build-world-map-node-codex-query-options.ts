import { RSC_QUERY_KEY_PREFIX } from '../query/rsc-query-key-prefix';
import { getWorldMapNodeCodexFragment } from './get-world-map-node-codex-fragment';

export function buildWorldMapNodeCodexQueryOptions(difficulty: number) {
  return {
    queryFn: () => getWorldMapNodeCodexFragment({ data: { difficulty } }),
    queryKey: [RSC_QUERY_KEY_PREFIX, 'world-map-node-codex', difficulty],

    // RSC values need this: Query's default deep-equality check can't run over a Composite
    // Component source.
    structuralSharing: false,
  };
}
