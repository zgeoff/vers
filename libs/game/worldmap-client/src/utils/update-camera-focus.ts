import type { PerspectiveCamera } from 'three';
import { Vector3 } from 'three';
import { CAMERA_DISTANCE, ISOMETRIC_OFFSET_X, ISOMETRIC_OFFSET_Z } from '../consts';

export function updateCameraFocus(camera: PerspectiveCamera, position: readonly [number, number]) {
  const [x, y] = position;

  const offset = new Vector3();

  offset.x = x + ISOMETRIC_OFFSET_X;
  offset.y = CAMERA_DISTANCE;
  offset.z = -(y - ISOMETRIC_OFFSET_Z);

  camera.position.copy(offset);
  camera.updateProjectionMatrix();
}
