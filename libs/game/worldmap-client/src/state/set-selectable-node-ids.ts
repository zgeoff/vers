import { useWorldmapStore } from './use-worldmap-store';

/**
 * Replaces the selectable-node set for the region the store already holds, for the event a graph
 * rebuild doesn't also cause — the completed set changing while the region stays the same. A graph
 * rebuild instead folds its own recomputed set into `setWorldRegion`'s single write.
 */
export function setSelectableNodeIDs(selectableNodeIDs: ReadonlySet<string>) {
  useWorldmapStore.setState({ selectableNodeIDs });
}
