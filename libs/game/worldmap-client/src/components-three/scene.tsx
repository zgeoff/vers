import { useMemo } from 'react';
import { useSelectedNode } from '../state/use-selected-node';
import { useWorldGraph } from '../state/use-world-graph';
import { buildNearbyGraph } from '../utils/build-nearby-graph';
import { AxesHelper } from './axes-helper';
import { DevCamera } from './dev-camera';
import { Floor } from './floor';
import { Fog } from './fog';
import { IsometricCamera } from './isometric-camera';
import { WorldEdges } from './world-edges';
import { WorldMapNodes } from './world-map-nodes';

function useFilteredGraph() {
  const graph = useWorldGraph();
  const selectedNode = useSelectedNode();

  return useMemo(() => buildNearbyGraph(selectedNode.object3D, graph), [selectedNode, graph]);
}

export function Scene() {
  const filteredGraph = useFilteredGraph();
  const nodes = useMemo(() => Object.values(filteredGraph.nodes), [filteredGraph]);
  const edges = useMemo(() => Object.values(filteredGraph.edges), [filteredGraph]);

  return (
    <>
      <IsometricCamera />
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
