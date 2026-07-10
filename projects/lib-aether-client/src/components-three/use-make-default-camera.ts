import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { OrthographicCamera, PerspectiveCamera } from 'three';

/**
 * makes the camera held by `cameraRef` the scene's active render camera whenever `isActive` is
 * true, restoring whichever camera was active beforehand once it goes false or the component
 * unmounts.
 */
export function useMakeDefaultCamera(
  cameraRef: RefObject<null | OrthographicCamera | PerspectiveCamera>,
  isActive: boolean,
) {
  const get = useThree((state) => state.get);
  const set = useThree((state) => state.set);

  useEffect(() => {
    if (!isActive || !cameraRef.current) {
      return () => {};
    }

    const previousCamera = get().camera;

    set({ camera: cameraRef.current });

    return () => {
      set({ camera: previousCamera });
    };
  }, [cameraRef, get, isActive, set]);
}
