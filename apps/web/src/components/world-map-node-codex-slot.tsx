import { useSuspenseQuery } from '@tanstack/react-query';
import { CompositeComponent } from '@tanstack/react-start/rsc';
import { worldMapNodeCodexQueryOptions } from '../lib/worldmap/world-map-node-codex-query-options';

interface WorldMapNodeCodexSlotProps {
  readonly difficulty: number;
}

export function WorldMapNodeCodexSlot(props: WorldMapNodeCodexSlotProps) {
  const result = useSuspenseQuery(worldMapNodeCodexQueryOptions(props.difficulty));

  return <CompositeComponent src={result.data.src} />;
}
