import { sceneColors } from '@vers/design-system';
import { useIsDevCameraActive } from '../state/use-is-dev-camera-active';

export function Fog() {
  const isDevCameraActive = useIsDevCameraActive();

  if (isDevCameraActive) {
    return null;
  }

  return <fog args={[sceneColors.fog, 20, 200]} attach="fog" />;
}
