import { useQuery } from '@tanstack/react-query';
import { GameCanvas } from '@vers/game-rendering';
import { buildRegionGraph, setSelectedNode, setWorldGraph } from '@vers/worldmap-client';
import { toNodeID } from '@vers/worldmap-core';
import { useEffect } from 'react';
import invariant from 'tiny-invariant';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';
import { SceneRoot } from './scene-root';

/**
 * Ring radius of the lattice region generated around the active avatar's origin.
 */
const REGION_RADIUS = 24;

/**
 * The persistent canvas's world content: dynamically imported through `GameCanvasMount`'s
 * code-split boundary so three.js and the generated region never land in the initial bundle. The
 * region regenerates whenever the active avatar's seed changes — a fresh avatar or a switch
 * between avatars — and is otherwise left alone across re-renders.
 */
export function GameWorld() {
  const avatarQuery = useQuery(buildActiveAvatarQueryOptions());
  const seed = avatarQuery.data?.seed;

  useEffect(() => {
    if (seed === undefined) {
      return;
    }

    const worldGraph = buildRegionGraph(seed, REGION_RADIUS);
    const originNode = worldGraph.nodes[toNodeID(0, 0)];

    invariant(originNode, 'the generated region always contains its origin cell');
    setWorldGraph(worldGraph);
    setSelectedNode(originNode, null);
  }, [seed]);

  return (
    <GameCanvas>
      <SceneRoot />
    </GameCanvas>
  );
}
