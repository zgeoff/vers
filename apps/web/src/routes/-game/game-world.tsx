import { worldMapNodes } from '@vers/data';
import { GameCanvas } from '@vers/game-rendering';
import { setSelectedNode, setWorldGraph } from '@vers/worldmap-client';
import type { CompressedWorldMapNode } from '@vers/worldmap-core';
import { decompressWorldMapNodes } from '@vers/worldmap-core';
import { SceneRoot } from './scene-root';

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the world graph ships as plain JSON with no way to encode the branded CompressedWorldMapNode type at that boundary
const worldGraph = decompressWorldMapNodes(worldMapNodes as Array<CompressedWorldMapNode>);

// oxlint-disable-next-line typescript/no-non-null-assertion -- the world graph ships with at least one node
const firstNode = Object.values(worldGraph.nodes)[0]!;

setWorldGraph(worldGraph);
setSelectedNode(firstNode, null);

/**
 * The persistent canvas's world content: dynamically imported through `GameCanvasMount`'s
 * code-split boundary so three.js and the world graph payload never land in the initial bundle.
 */
export function GameWorld() {
  return (
    <GameCanvas>
      <SceneRoot />
    </GameCanvas>
  );
}
