import { useMemo } from 'react';
import { Object3D } from 'three';
import { getScenePosition } from '../utils/get-scene-position';
import { useWorldmapStore } from './use-worldmap-store';

/**
 * Reads the selected node alongside its scene `Object3D`. A node selected without one — the
 * URL-driven path has no rendered mesh to hand `setSelectedNode` — resolves a synthetic `Object3D`
 * positioned at the node's own scene position instead, so every consumer of `object3D` (camera
 * targeting, distance-based graph filtering) sees a real position instead of recentering to the
 * origin.
 */
export function useSelectedNode() {
  const node = useWorldmapStore((state) => state.selectedNode);
  const storedObject3D = useWorldmapStore((state) => state.selectedObject3D);

  return useMemo(() => {
    if (storedObject3D || !node) {
      return { node, object3D: storedObject3D };
    }

    const object3D = new Object3D();

    object3D.position.set(...getScenePosition(node.position));

    return { node, object3D };
  }, [node, storedObject3D]);
}
