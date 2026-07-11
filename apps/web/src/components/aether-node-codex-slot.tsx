import { useSuspenseQuery } from '@tanstack/react-query';
import { CompositeComponent } from '@tanstack/react-start/rsc';
import { aetherNodeCodexQueryOptions } from '../lib/aether/aether-node-codex-query-options';

interface AetherNodeCodexSlotProps {
  readonly difficulty: number;
}

export function AetherNodeCodexSlot(props: AetherNodeCodexSlotProps) {
  const result = useSuspenseQuery(aetherNodeCodexQueryOptions(props.difficulty));

  return <CompositeComponent src={result.data.src} />;
}
