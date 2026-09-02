import type { RevealSource } from '@vers/worldmap-core';
import { useWorldmapStore } from './use-worldmap-store';

export function setCompletedNodeProjections(
  selectableNodeIDs: ReadonlySet<string>,
  revealSources: ReadonlyArray<RevealSource>,
) {
  useWorldmapStore.setState({ revealSources, selectableNodeIDs });
}
