import { GameCanvas } from '@vers/game-rendering';
import { SceneRoot } from './scene-root';
import { useAvatarRegionGraph } from './use-avatar-region-graph';
import { useRevealedNodesQuery } from './use-revealed-nodes-query';

/**
 * The persistent canvas's world content: dynamically imported through `GameCanvasMount`'s
 * code-split boundary so three.js and the generated region never land in the initial bundle.
 */
export function GameWorld() {
  useAvatarRegionGraph();
  useRevealedNodesQuery();

  return (
    <GameCanvas>
      <SceneRoot />
    </GameCanvas>
  );
}
