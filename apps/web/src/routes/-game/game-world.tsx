import { setAetherGraph, setSelectedNode } from '@vers/aether-client';
import type { CompressedAetherNode } from '@vers/aether-core';
import { decompressAetherNodes } from '@vers/aether-core';
import { aetherNodes } from '@vers/data';
import { GameCanvas } from '@vers/game-rendering';
import { SceneRoot } from './scene-root';

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the aether graph ships as plain JSON with no way to encode the branded CompressedAetherNode type at that boundary
const aetherGraph = decompressAetherNodes(aetherNodes as Array<CompressedAetherNode>);

// oxlint-disable-next-line typescript/no-non-null-assertion -- the aether graph ships with at least one node
const firstNode = Object.values(aetherGraph.nodes)[0]!;

setAetherGraph(aetherGraph);
setSelectedNode(firstNode, null);

/**
 * The persistent canvas's world content: dynamically imported through `GameCanvasMount`'s
 * code-split boundary so three.js and the aether graph payload never land in the initial bundle.
 */
export function GameWorld() {
  return (
    <GameCanvas>
      <SceneRoot />
    </GameCanvas>
  );
}
