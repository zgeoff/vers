import { useMemo } from 'react';
import { useAetherGraph } from '../state/use-aether-graph';
import { useSelectedNode } from '../state/use-selected-node';
import { filterDistanceGraph } from '../utils/filter-distant-graph';
import { AetherEdges } from './aether-edges';
import { AetherNodes } from './aether-nodes';
import { AxesHelper } from './axes-helper';
import { DevCamera } from './dev-camera';
import { Floor } from './floor';
import { Fog } from './fog';
import { IsometricCamera } from './isometric-camera';

function useFilteredGraph() {
  const graph = useAetherGraph();
  const selectedNode = useSelectedNode();

  return useMemo(() => filterDistanceGraph(selectedNode.object3D, graph), [selectedNode, graph]);
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
        <AetherNodes nodes={nodes} />
        <AetherEdges edges={edges} />
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
