import { Euler, Vector3 } from 'three';

const rotation = new Euler(-Math.PI / 2, 0, 0);
const position = new Vector3(0, -0.1, 0);

const color = '#3d424d';
const size = 10_000;

export function Floor() {
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}
