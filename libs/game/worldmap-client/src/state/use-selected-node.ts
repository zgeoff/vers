import { useMemo } from 'react';
import { Object3D } from 'three';
import { getScenePosition } from '../utils/get-scene-position';
import { useWorldmapStore } from './use-worldmap-store';

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
