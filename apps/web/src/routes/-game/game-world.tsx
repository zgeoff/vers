import { GameCanvas } from '@vers/game-rendering';
import { buildRegionGraph, setSelectedNode, setWorldGraph } from '@vers/worldmap-client';
import { toNodeID } from '@vers/worldmap-core';
import { SceneRoot } from './scene-root';

/**
 * Seed the geometry generator draws from until the avatar's own seed is wired through; zero renders
 * a stable placeholder region.
 */
const WORLD_SEED = 0;

/**
 * Ring radius of the lattice region generated for the initial render.
 */
const REGION_RADIUS = 24;
const worldGraph = buildRegionGraph(WORLD_SEED, REGION_RADIUS);

// oxlint-disable-next-line typescript/no-non-null-assertion -- the region always contains its origin cell
const originNode = worldGraph.nodes[toNodeID(0, 0)]!;

setWorldGraph(worldGraph);
setSelectedNode(originNode, null);

/**
 * The persistent canvas's world content: dynamically imported through `GameCanvasMount`'s
 * code-split boundary so three.js and the generated region never land in the initial bundle.
 */
export function GameWorld() {
  return (
    <GameCanvas>
      <SceneRoot />
    </GameCanvas>
  );
}
