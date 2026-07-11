import { extend, useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type { AetherNode } from '@vers/aether-core';
import { sceneColors } from '@vers/design-system';
import { useLayoutEffect, useRef } from 'react';
import type { InstancedMesh } from 'three';
import { Color, Matrix4 } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { setHoveredNode } from '../state/set-hovered-node';
import { setSelectedNode } from '../state/set-selected-node';
import { useSelectedNodeStore } from '../state/use-selected-node-store';
import { getScenePosition } from '../utils/get-scene-position';

interface AetherNodesProps {
  readonly nodes: ReadonlyArray<AetherNode>;
}

const RADIUS = 0.8;
const NODE_SEGMENTS = 24;

const BASE_COLOR = new Color(sceneColors.nodeBase);
const SELECTED_COLOR = new Color(sceneColors.nodeSelected);

const AetherNodeMaterial = extend(MeshStandardNodeMaterial);

const instanceMatrix = new Matrix4();

export function AetherNodes(props: Readonly<AetherNodesProps>) {
  const meshRef = useRef<InstancedMesh | null>(null);
  const appliedSelectedNodeIDRef = useRef<null | string>(null);

  // rebuild every instance's transform and base color whenever the node list changes: a fresh
  // `InstancedMesh` (its `args`-derived count changed) has no prior state to preserve
  useLayoutEffect(() => {
    const mesh = meshRef.current;

    if (!mesh) {
      return;
    }

    const selectedNodeID = useSelectedNodeStore.getState().node?.id ?? null;

    for (const [index, node] of props.nodes.entries()) {
      const [x, y, z] = getScenePosition(node.position);
      const color = node.id === selectedNodeID ? SELECTED_COLOR : BASE_COLOR;

      mesh.setMatrixAt(index, instanceMatrix.makeTranslation(x, y, z));
      mesh.setColorAt(index, color);
    }

    mesh.instanceMatrix.needsUpdate = true;

    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }

    appliedSelectedNodeIDRef.current = selectedNodeID;
  }, [props.nodes]);

  // selection highlight is driven imperatively from the store rather than a reactive selector, so
  // a hover/selection change never forces this component to re-render
  useFrame(() => {
    const mesh = meshRef.current;

    if (!mesh) {
      return;
    }

    const selectedNodeID = useSelectedNodeStore.getState().node?.id ?? null;

    if (selectedNodeID === appliedSelectedNodeIDRef.current) {
      return;
    }

    const previousIndex = props.nodes.findIndex(
      (node) => node.id === appliedSelectedNodeIDRef.current,
    );

    if (previousIndex !== -1) {
      mesh.setColorAt(previousIndex, BASE_COLOR);
    }

    const nextIndex = props.nodes.findIndex((node) => node.id === selectedNodeID);

    if (nextIndex !== -1) {
      mesh.setColorAt(nextIndex, SELECTED_COLOR);
    }

    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }

    appliedSelectedNodeIDRef.current = selectedNodeID;
  });

  const handlePointerEnter = (event: ThreeEvent<PointerEvent>) => {
    if (event.instanceId === undefined) {
      return;
    }

    setHoveredNode(props.nodes[event.instanceId] ?? null);
  };

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.instanceId === undefined) {
      return;
    }

    const node = props.nodes[event.instanceId];

    if (!node) {
      return;
    }

    // TODO(#119): limit node navigation to nodes connected to any completed node
    setSelectedNode(node);
  };

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, props.nodes.length]}
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <circleGeometry args={[RADIUS, NODE_SEGMENTS]} />
      <AetherNodeMaterial />
    </instancedMesh>
  );
}

function handlePointerLeave() {
  setHoveredNode(null);
}
