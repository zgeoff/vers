import { Canvas } from '@react-three/fiber';
import { DevTools, NodeTooltip, Scene, setAetherGraph, setSelectedNode } from '@vers/aether-client';
import type { CompressedAetherNode } from '@vers/aether-core';
import { decompressAetherNodes } from '@vers/aether-core';
import { aetherNodes } from '@vers/data';
import { SelectedNodeInfo } from './selected-node-info';

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the aether graph ships as plain JSON with no way to encode the branded CompressedAetherNode type at that boundary
const aetherGraph = decompressAetherNodes(aetherNodes as Array<CompressedAetherNode>);

// oxlint-disable-next-line typescript/no-non-null-assertion -- the aether graph ships with at least one node
const firstNode = Object.values(aetherGraph.nodes)[0]!;

setAetherGraph(aetherGraph);
setSelectedNode(firstNode, null);

/**
 * The aether map's three.js scene: dynamically imported through a code-split boundary so three.js
 * and the R3F canvas never land in the initial bundle.
 */
export function AetherCanvas() {
  return (
    <>
      <Canvas>
        <Scene />
      </Canvas>
      <NodeTooltip />
      <SelectedNodeInfo />
      {import.meta.env.DEV && <DevTools />}
    </>
  );
}
