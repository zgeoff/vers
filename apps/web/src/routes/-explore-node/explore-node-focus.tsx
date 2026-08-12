import { setSelectedNode, useSelectableNodeIDs, useWorldGraph } from '@vers/worldmap-client';
import { useEffect } from 'react';

interface ExploreNodeFocusProps {
  readonly nodeID: string;
}

/**
 * Selects the graph node named by the route param, gated on the store's selectable-node set the
 * same way a node click is, so a deep link can never select — and auto-start — a node the avatar
 * cannot reach. An id missing from the graph or outside the selectable set is a plain miss:
 * nothing renders and no selection changes.
 */
export function ExploreNodeFocus(props: ExploreNodeFocusProps) {
  const graph = useWorldGraph();
  const selectableNodeIDs = useSelectableNodeIDs();
  const node = selectableNodeIDs.has(props.nodeID) ? graph.nodes[props.nodeID] : undefined;

  useEffect(() => {
    if (node !== undefined) {
      setSelectedNode(node);
    }
  }, [props.nodeID, node]);

  return null;
}
