import { Canvas } from '@react-three/fiber';
import { DevTools, NodeTooltip, Scene, setAetherGraph, setSelectedNode } from '@vers/aether-client';
import type { CompressedAetherNode } from '@vers/aether-core';
import { decompressAetherNodes } from '@vers/aether-core';
import { aetherNodes } from '@vers/data';
import * as styles from './route.styles';
import { SelectedNodeInfo } from './selected-node-info';

const aetherGraph = decompressAetherNodes(aetherNodes as Array<CompressedAetherNode>);

// oxlint-disable-next-line typescript/no-non-null-assertion -- the aether graph ships with at least one node
const firstNode = Object.values(aetherGraph.nodes)[0]!;

setAetherGraph(aetherGraph);
setSelectedNode(firstNode, null);

export function Aether() {
  return (
    <>
      <Canvas>
        <Scene />
      </Canvas>
      <NodeTooltip className={styles.tooltip} />
      <SelectedNodeInfo className={styles.selectedNodeInfo} />
      {import.meta.env.DEV && <DevTools />}
    </>
  );
}
