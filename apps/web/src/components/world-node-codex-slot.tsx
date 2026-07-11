import { useSuspenseQuery } from '@tanstack/react-query';
import { CompositeComponent } from '@tanstack/react-start/rsc';
import { worldNodeCodexQueryOptions } from '../lib/worldmap/world-node-codex-query-options';

interface WorldNodeCodexSlotProps {
  readonly difficulty: number;
}

export function WorldNodeCodexSlot(props: WorldNodeCodexSlotProps) {
  const result = useSuspenseQuery(worldNodeCodexQueryOptions(props.difficulty));

  return <CompositeComponent src={result.data.src} />;
}
