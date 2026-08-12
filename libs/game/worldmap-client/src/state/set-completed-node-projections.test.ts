import { expect, test } from 'bun:test';
import { setCompletedNodeProjections } from './set-completed-node-projections';
import { useWorldmapStore } from './use-worldmap-store';

test('it replaces the selectable set and reveal sources in one write', () => {
  const selectable = new Set(['node1', 'node2']);

  const sources = [{ coord: [1, 2] as const, radius: 2 }];

  setCompletedNodeProjections(selectable, sources);

  expect(useWorldmapStore.getState().selectableNodeIDs).toBe(selectable);
  expect(useWorldmapStore.getState().revealSources).toBe(sources);
});
