import { Canvas, useFrame } from '@react-three/fiber';
import { css } from '@vers/styled-system/css';
import { useRef } from 'react';
import type { Mesh } from 'three';

const card = css({
  backgroundColor: 'bg.panel',
  borderColor: 'border',
  borderRadius: 'md',
  borderWidth: '[1px]',
  height: '64',
  overflow: 'hidden',
  width: '64',
});

/**
 * A self-contained satellite widget: its own plain R3F `Canvas` with the default WebGL
 * renderer, isolated from the persistent world canvas and its `WebGPURenderer`/game-loop
 * scheduler. No assets — a single rotating primitive stands in for avatar rendering.
 */
export function AvatarViewer() {
  return (
    <div className={card} data-testid="avatar-viewer">
      <Canvas camera={{ position: [0, 0, 4] }}>
        <ambientLight intensity={0.6} />
        <directionalLight intensity={0.8} position={[3, 3, 3]} />
        <PlaceholderAvatar />
      </Canvas>
    </div>
  );
}

const ROTATION_SPEED = 0.4;

function PlaceholderAvatar() {
  const meshRef = useRef<Mesh>(null);

  useFrame((_state, delta) => {
    if (meshRef.current !== null) {
      meshRef.current.rotation.y += delta * ROTATION_SPEED;
    }
  });

  return (
    <mesh ref={meshRef}>
      <capsuleGeometry args={[0.6, 1.2, 4, 8]} />
      <meshStandardMaterial color="#D8A56E" flatShading />
    </mesh>
  );
}
