import { extend } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import type { InstancedMesh } from 'three';
import { Color, Object3D } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';

const GROUND_COLOR = '#3d424d';
const GROUND_SIZE = 40;

const BLOCK_COLOR = '#8fa0c2';

// a handful of flat-topped blocks standing in for buildings: [x, height, z]
const BLOCKS: ReadonlyArray<readonly [number, number, number]> = [
  [-4, 1.5, -3],
  [-1.5, 2, -4],
  [1, 1.2, -3.5],
  [3.5, 2.5, -4],
  [-3, 1, -1],
  [2, 1.4, -1.5],
];

const RespiteMaterial = extend(MeshBasicNodeMaterial);

const blockColor = new Color(BLOCK_COLOR);
const dummy = new Object3D();

/**
 * The home city's placeholder scene: a ground plane and a handful of instanced blocks standing in
 * for buildings, until respite grows real content.
 */
export function RespiteScene() {
  const blocksRef = useRef<InstancedMesh | null>(null);

  useLayoutEffect(() => {
    const blocks = blocksRef.current;

    if (!blocks) {
      return;
    }

    for (const [index, [x, height, z]] of BLOCKS.entries()) {
      dummy.position.set(x, height / 2, z);
      dummy.scale.set(1, height, 1);
      dummy.updateMatrix();

      blocks.setMatrixAt(index, dummy.matrix);
      blocks.setColorAt(index, blockColor);
    }

    blocks.instanceMatrix.needsUpdate = true;

    if (blocks.instanceColor) {
      blocks.instanceColor.needsUpdate = true;
    }
  }, []);

  return (
    <>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <RespiteMaterial color={GROUND_COLOR} />
      </mesh>

      <instancedMesh ref={blocksRef} args={[undefined, undefined, BLOCKS.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <RespiteMaterial />
      </instancedMesh>
    </>
  );
}
