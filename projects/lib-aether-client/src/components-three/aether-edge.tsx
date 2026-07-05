import type { AetherEdge } from '@vers/aether-core';
import { BufferGeometry, Vector3 } from 'three';
import { getScenePosition } from '../utils/get-scene-position';

interface AetherEdgeProps {
  edge: AetherEdge;
}

export function AetherEdge(props: AetherEdgeProps) {
  const points = [
    new Vector3(...getScenePosition(props.edge.start)),
    new Vector3(...getScenePosition(props.edge.end)),
  ];

  const lineGeometry = new BufferGeometry().setFromPoints(points);

  return (
    // @ts-expect-error - this should map to the THREE.Line type, not the SVG line element
    <line geometry={lineGeometry}>
      <lineBasicMaterial color="#64748b" />
    </line>
  );
}
