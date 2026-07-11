import { setSelectedNode, useWorldGraph } from '@vers/worldmap-client';
import { useEffect } from 'react';

interface ExploreNodeFocusProps {
  readonly nodeID: string;
}

/**
 * Selects the graph node named by the route param through the same store write a node click
 * makes, so the persistent canvas's existing selection/camera-focus flow carries the deep link the
 * rest of the way. An id with no match in the graph is a plain miss: nothing renders and no
 * selection changes.
 */
export function ExploreNodeFocus(props: ExploreNodeFocusProps) {
  const graph = useWorldGraph();
  const node = graph.nodes[props.nodeID];

  useEffect(() => {
    if (node !== undefined) {
      setSelectedNode(node);
    }
  }, [props.nodeID, node]);

  return null;
}
