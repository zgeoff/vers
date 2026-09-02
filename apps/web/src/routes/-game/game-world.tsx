import { GameCanvas } from '@vers/game-rendering';
import { SceneRoot } from './scene-root';
import { useAvatarRegionGraph } from './use-avatar-region-graph';
import { useSeedPrefetch } from './use-seed-prefetch';

export function GameWorld() {
  const revealedNodeIDs = useAvatarRegionGraph();

  useSeedPrefetch(revealedNodeIDs);

  return (
    <GameCanvas>
      <SceneRoot />
    </GameCanvas>
  );
}
