import { extend } from '@react-three/fiber';
import { sceneColors } from '@vers/design-system';
import { Euler, Vector3 } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';

const rotation = new Euler(-Math.PI / 2, 0, 0);
const position = new Vector3(0, -0.1, 0);

const color = sceneColors.ground;
const size = 10_000;

const FloorMaterial = extend(MeshBasicNodeMaterial);

export function Floor() {
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[size, size]} />
      <FloorMaterial color={color} />
    </mesh>
  );
}
