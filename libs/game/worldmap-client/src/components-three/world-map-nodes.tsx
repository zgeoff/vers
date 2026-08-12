import { extend, useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { sceneColors } from '@vers/design-system';
import type { WorldMapNode } from '@vers/worldmap-core';
import { useLayoutEffect, useRef } from 'react';
import type { InstancedMesh } from 'three';
import { Color, Matrix4 } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { setHoveredNode } from '../state/set-hovered-node';
import { setSelectedNode } from '../state/set-selected-node';
import { useWorldmapStore } from '../state/use-worldmap-store';
import { getScenePosition } from '../utils/get-scene-position';

interface WorldMapNodesProps {
  readonly nodes: ReadonlyArray<WorldMapNode>;
}

const RADIUS = 0.8;
const NODE_SEGMENTS = 24;

const BASE_COLOR = new Color(sceneColors.nodeBase);
const DIMMED_COLOR = new Color(sceneColors.nodeDimmed);
const SELECTED_COLOR = new Color(sceneColors.nodeSelected);

const WorldMapNodeMaterial = extend(MeshStandardNodeMaterial);

const instanceMatrix = new Matrix4();

export function WorldMapNodes(props: Readonly<WorldMapNodesProps>) {
  const meshRef = useRef<InstancedMesh | null>(null);
  const appliedSelectedNodeIDRef = useRef<null | string>(null);
  const appliedSelectableNodeIDsRef = useRef<null | ReadonlySet<string>>(null);

  // rebuild every instance's transform and base color whenever the node list changes: a fresh
  // `InstancedMesh` (its `args`-derived count changed) has no prior state to preserve
  useLayoutEffect(() => {
    const mesh = meshRef.current;

    if (!mesh) {
      return;
    }

    const selectedNodeID = useWorldmapStore.getState().selectedNode?.id ?? null;
    const selectableNodeIDs = useWorldmapStore.getState().selectableNodeIDs;

    for (const [index, node] of props.nodes.entries()) {
      const [x, y, z] = getScenePosition(node.position);
      const color = buildRestingColor(node.id, selectedNodeID, selectableNodeIDs);

      mesh.setMatrixAt(index, instanceMatrix.makeTranslation(x, y, z));
      mesh.setColorAt(index, color);
    }

    mesh.instanceMatrix.needsUpdate = true;

    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }

    // three derives an InstancedMesh's bounding sphere once, lazily, and a matrix rewrite doesn't
    // invalidate it — without this recompute, a reused mesh (same instance count, new node list)
    // keeps the sphere anchored over the previous region, so the frustum culls every node once the
    // camera pans away and raycasting's sphere gate stops pointer events with it
    mesh.computeBoundingSphere();

    appliedSelectedNodeIDRef.current = selectedNodeID;
    appliedSelectableNodeIDsRef.current = selectableNodeIDs;
  }, [props.nodes]);

  // selection and dimming highlights are driven imperatively from the store rather than a
  // reactive selector, so neither a hover/selection change nor a completed-set change ever forces
  // this component to re-render
  useFrame(() => {
    const mesh = meshRef.current;

    if (!mesh) {
      return;
    }

    const selectedNodeID = useWorldmapStore.getState().selectedNode?.id ?? null;
    const selectableNodeIDs = useWorldmapStore.getState().selectableNodeIDs;

    if (selectableNodeIDs !== appliedSelectableNodeIDsRef.current) {
      for (const [index, node] of props.nodes.entries()) {
        if (node.id === selectedNodeID) {
          continue;
        }

        const restingColor = selectableNodeIDs.has(node.id) ? BASE_COLOR : DIMMED_COLOR;

        mesh.setColorAt(index, restingColor);
      }

      appliedSelectableNodeIDsRef.current = selectableNodeIDs;

      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    }

    if (selectedNodeID === appliedSelectedNodeIDRef.current) {
      return;
    }

    const previousID = appliedSelectedNodeIDRef.current;
    const previousIndex = props.nodes.findIndex((node) => node.id === previousID);

    if (previousIndex !== -1 && previousID !== null) {
      const previousRestingColor = selectableNodeIDs.has(previousID) ? BASE_COLOR : DIMMED_COLOR;

      mesh.setColorAt(previousIndex, previousRestingColor);
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

    if (!node || !useWorldmapStore.getState().selectableNodeIDs.has(node.id)) {
      return;
    }

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
      <WorldMapNodeMaterial />
    </instancedMesh>
  );
}

/**
 * The color a node instance takes outside a pointer-driven transition: selected, then selectable
 * base, then dimmed for a node outside the avatar's selectable set.
 */
function buildRestingColor(
  nodeID: string,
  selectedNodeID: null | string,
  selectableNodeIDs: ReadonlySet<string>,
): Color {
  if (nodeID === selectedNodeID) {
    return SELECTED_COLOR;
  }

  return selectableNodeIDs.has(nodeID) ? BASE_COLOR : DIMMED_COLOR;
}

function handlePointerLeave() {
  setHoveredNode(null);
}
