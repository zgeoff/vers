import { useSuspenseQuery } from '@tanstack/react-query';
import { CompositeComponent } from '@tanstack/react-start/rsc';
import { buildWorldMapNodeCodexQueryOptions } from '../lib/worldmap/build-world-map-node-codex-query-options';

interface WorldMapNodeCodexSlotProps {
  readonly difficulty: number;
}

export function WorldMapNodeCodexSlot(props: WorldMapNodeCodexSlotProps) {
  const result = useSuspenseQuery(buildWorldMapNodeCodexQueryOptions(props.difficulty));

  return <CompositeComponent src={result.data.src} />;
}
