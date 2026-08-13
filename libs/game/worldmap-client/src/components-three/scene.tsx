import { useMemo } from 'react';
import { useIsFogOfWarVisible } from '../state/use-is-fog-of-war-visible';
import { useWorldGraph } from '../state/use-world-graph';
import { AxesHelper } from './axes-helper';
import { ChunkGround, ChunkScatter } from './chunk-world';
import { DevCamera } from './dev-camera';
import { Floor } from './floor';
import { FogOfWar } from './fog-of-war';
import { PerfProbe } from './perf-probe';
import { IsometricCamera } from './isometric-camera';
import { ViewportTracker } from './viewport-tracker';
import { WorldEdges } from './world-edges';
import { WorldMapNodes } from './world-map-nodes';

export function Scene() {
  const worldGraph = useWorldGraph();
  const isFogOfWarVisible = useIsFogOfWarVisible();
  const nodes = useMemo(() => Object.values(worldGraph.nodes), [worldGraph]);
  const edges = useMemo(() => Object.values(worldGraph.edges), [worldGraph]);

  return (
    <>
      <IsometricCamera />
      <ViewportTracker />
      <ambientLight intensity={1.05} />

      <group rotation={[-Math.PI / 2, 0, 0]}>
        <ChunkGround />
        <ChunkScatter />
        <WorldMapNodes nodes={nodes} />
        <WorldEdges edges={edges} />
        {isFogOfWarVisible && <FogOfWar />}
      </group>

      <Floor />

      {import.meta.env.DEV && (
        <>
          <DevCamera />
          <AxesHelper />
          <PerfProbe />
        </>
      )}
    </>
  );
}
