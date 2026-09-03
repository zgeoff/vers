import { setSelectedNode, useSelectableNodeIDs, useWorldGraph } from '@vers/worldmap-client';
import { useEffect } from 'react';

interface ExploreNodeFocusProps {
  readonly nodeID: string;
}

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
