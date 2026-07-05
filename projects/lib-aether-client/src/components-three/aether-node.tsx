import type { ThreeEvent } from '@react-three/fiber';
import type { AetherNode } from '@vers/aether-core';
import { useCallback } from 'react';
import type { Mesh } from 'three';
import { setHoveredNode } from '../state/set-hovered-node';
import { setSelectedNode } from '../state/set-selected-node';
import { useSelectedNode } from '../state/use-selected-node';
import { getScenePosition } from '../utils/get-scene-position';

interface AetherNodeProps {
  node: AetherNode;
}

const RADIUS = 0.8;
const NODE_SEGMENTS = 24;

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function AetherNode(props: AetherNodeProps) {
  const position = getScenePosition(props.node.position);
  const selectedNode = useSelectedNode();

  // if the node is selected but we're doing our initial render this is our opportunity
  // to grab a reference to the scene node
  const setSelectedNodeRef = useCallback(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
    (object3D: Mesh | undefined) => {
      const isSelected = selectedNode.node?.id === props.node.id;
      const isInitialRender = !selectedNode.object3D && object3D;

      // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
      if (isSelected && isInitialRender) {
        setSelectedNode(props.node, object3D);
      }
    },
    [props.node, selectedNode.node?.id, selectedNode.object3D],
  );

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  const handleClickNode = (event: ThreeEvent<PointerEvent>) => {
    // TODO(#119): limit node navigation to nodes connected to any completed node
    setSelectedNode(props.node, event.object);
  };

  return (
    <mesh
      ref={setSelectedNodeRef}
      position={position}
      // its important we attach our node ID so we can look it up without selecting
      userData={{ id: props.node.id }}
      // oxlint-disable-next-line typescript/no-confusing-void-expression, typescript/prefer-readonly-parameter-types -- baseline(#236)
      onPointerDown={(event: ThreeEvent<PointerEvent>) => handleClickNode(event)}
      // oxlint-disable-next-line typescript/no-confusing-void-expression -- baseline(#236)
      onPointerEnter={() => setHoveredNode(props.node)}
      // oxlint-disable-next-line typescript/no-confusing-void-expression -- baseline(#236)
      onPointerLeave={() => setHoveredNode(null)}
    >
      <circleGeometry args={[RADIUS, NODE_SEGMENTS]} />
      <meshStandardMaterial
        color={selectedNode.node?.id === props.node.id ? '#7dd3fc' : '#cbd5e1'}
      />
    </mesh>
  );
}
