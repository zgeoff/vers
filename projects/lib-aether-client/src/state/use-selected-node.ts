import { useMemo } from 'react';
import { Object3D } from 'three';
import { useShallow } from 'zustand/react/shallow';
import { getScenePosition } from '../utils/get-scene-position';
import { useSelectedNodeStore } from './use-selected-node-store';

/**
 * Reads the selected node alongside its scene `Object3D`. A node selected without one — the
 * URL-driven path has no rendered mesh to hand `setSelectedNode` — resolves a synthetic `Object3D`
 * positioned at the node's own scene position instead, so every consumer of `object3D` (camera
 * targeting, distance-based graph filtering) sees a real position instead of recentering to the
 * origin.
 */
export function useSelectedNode() {
  const selectedNode = useSelectedNodeStore(
    useShallow((state) => ({
      node: state.node,
      object3D: state.object3D,
    })),
  );

  return useMemo(() => {
    if (selectedNode.object3D || !selectedNode.node) {
      return selectedNode;
    }

    const object3D = new Object3D();

    object3D.position.set(...getScenePosition(selectedNode.node.position));

    return { node: selectedNode.node, object3D };
  }, [selectedNode]);
}
