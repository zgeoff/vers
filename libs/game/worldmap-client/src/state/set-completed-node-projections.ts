import type { RevealSource } from '@vers/worldmap-core';
import { useWorldmapStore } from './use-worldmap-store';

/**
 * Replaces the two derivations of the completed-node set — the selectable-node set and the reveal
 * sources fog projects from — in one write, for the event a graph rebuild doesn't also cause: the
 * completed set changing while the region stays the same. A graph rebuild instead folds its own
 * recomputed derivations into the region write.
 */
export function setCompletedNodeProjections(
  selectableNodeIDs: ReadonlySet<string>,
  revealSources: ReadonlyArray<RevealSource>,
) {
  useWorldmapStore.setState({ revealSources, selectableNodeIDs });
}
