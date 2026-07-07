import { useSuspenseQuery } from '@tanstack/react-query';
import { CompositeComponent } from '@tanstack/react-start/rsc';
import { aetherNodeCodexQueryOptions } from '../lib/aether/aether-node-codex-query-options';

interface AetherNodeCodexSlotProps {
  readonly difficulty: number;
}

/**
 * The aether node detail view's client-owned slot for the codex fragment: Query caches the
 * server-rendered Composite Component source, same machinery as the index route's session badge.
 */
export function AetherNodeCodexSlot(props: AetherNodeCodexSlotProps) {
  const result = useSuspenseQuery(aetherNodeCodexQueryOptions(props.difficulty));

  return <CompositeComponent src={result.data.src} />;
}
