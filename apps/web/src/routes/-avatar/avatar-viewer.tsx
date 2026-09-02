import { Canvas, useFrame } from '@react-three/fiber';
import { sceneColors } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { useRef } from 'react';
import type { Mesh } from 'three';

interface AvatarViewerProps {
  readonly placeholder?: boolean;
}

const card = css({
  backgroundColor: 'bg.panel',
  borderColor: 'border',
  borderWidth: '[1px]',
  height: '64',
  overflow: 'hidden',
  width: '64',
});

const placeholderCanvas = css({ display: '[block]', height: '[100%]', width: '[100%]' });

export function AvatarViewer(props: Readonly<AvatarViewerProps>) {
  return (
    <div className={card} data-testid="avatar-viewer">
      {(props.placeholder ?? false) ? (
        <canvas className={placeholderCanvas} />
      ) : (
        <Canvas camera={{ position: [0, 0, 4] }}>
          <ambientLight intensity={0.6} />
          <directionalLight intensity={0.8} position={[3, 3, 3]} />
          <PlaceholderAvatar />
        </Canvas>
      )}
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
      <meshStandardMaterial color={sceneColors.avatarPlaceholder} flatShading />
    </mesh>
  );
}
