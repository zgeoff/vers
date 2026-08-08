import { extend } from '@react-three/fiber';
import { sceneColors } from '@vers/design-system';
import type { WorldEdge } from '@vers/worldmap-core';
import { useLayoutEffect, useRef } from 'react';
import type { BufferGeometry } from 'three';
import { BufferAttribute } from 'three';
import { LineBasicNodeMaterial } from 'three/webgpu';
import { getScenePosition } from '../utils/get-scene-position';

interface WorldEdgesProps {
  readonly edges: ReadonlyArray<WorldEdge>;
}

const COLOR = sceneColors.worldmapEdge;
const POSITION_COMPONENTS_PER_EDGE = 6;
const VERTEX_SIZE = 3;
const WorldEdgeMaterial = extend(LineBasicNodeMaterial);

export function WorldEdges(props: Readonly<WorldEdgesProps>) {
  const geometryRef = useRef<BufferGeometry | null>(null);

  // one draw call for every edge: each edge contributes a start/end vertex pair to a single
  // position buffer that `lineSegments` interprets as independent segments
  useLayoutEffect(() => {
    const geometry = geometryRef.current;

    if (!geometry) {
      return;
    }

    const positions = new Float32Array(props.edges.length * POSITION_COMPONENTS_PER_EDGE);

    for (const [index, edge] of props.edges.entries()) {
      positions.set(
        [...getScenePosition(edge.start), ...getScenePosition(edge.end)],
        index * POSITION_COMPONENTS_PER_EDGE,
      );
    }

    geometry.setAttribute('position', new BufferAttribute(positions, VERTEX_SIZE));
    geometry.computeBoundingSphere();
  }, [props.edges]);

  return (
    <lineSegments>
      <bufferGeometry ref={geometryRef} />
      <WorldEdgeMaterial color={COLOR} />
    </lineSegments>
  );
}
