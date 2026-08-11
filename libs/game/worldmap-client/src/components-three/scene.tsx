import { useMemo } from 'react';
import { useWorldGraph } from '../state/use-world-graph';
import { AxesHelper } from './axes-helper';
import { DevCamera } from './dev-camera';
import { Floor } from './floor';
import { Fog } from './fog';
import { IsometricCamera } from './isometric-camera';
import { ViewportTracker } from './viewport-tracker';
import { WorldEdges } from './world-edges';
import { WorldMapNodes } from './world-map-nodes';

export function Scene() {
  const worldGraph = useWorldGraph();
  const nodes = useMemo(() => Object.values(worldGraph.nodes), [worldGraph]);
  const edges = useMemo(() => Object.values(worldGraph.edges), [worldGraph]);

  return (
    <>
      <IsometricCamera />
      <ViewportTracker />
      <ambientLight intensity={0.8} />

      <group rotation={[-Math.PI / 2, 0, 0]}>
        <WorldMapNodes nodes={nodes} />
        <WorldEdges edges={edges} />
      </group>

      <Fog />
      <Floor />

      {import.meta.env.DEV && (
        <>
          <DevCamera />
          <AxesHelper />
        </>
      )}
    </>
  );
}
