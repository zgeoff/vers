import { useMemo } from 'react';
import { useAetherGraph } from '../state/use-aether-graph';
import { useSelectedNode } from '../state/use-selected-node';
import { filterDistanceGraph } from '../utils/filter-distant-graph';
import { AetherEdge } from './aether-edge';
import { AetherNode } from './aether-node';
import { AxesHelper } from './axes-helper';
import { DevCamera } from './dev-camera';
import { Floor } from './floor';
import { Fog } from './fog';
import { IsometricCamera } from './isometric-camera';

export function useFilteredGraph() {
  const graph = useAetherGraph();
  const selectedNode = useSelectedNode();

  return useMemo(() => filterDistanceGraph(selectedNode.object3D, graph), [selectedNode, graph]);
}

export function Scene() {
  const filteredGraph = useFilteredGraph();

  return (
    <>
      <IsometricCamera />
      <ambientLight intensity={0.8} />

      <group rotation={[-Math.PI / 2, 0, 0]}>
        {Object.values(filteredGraph.nodes).map((node) => (
          <AetherNode key={node.id} node={node} />
        ))}
        {Object.values(filteredGraph.edges).map((edge) => (
          <AetherEdge key={edge.id} edge={edge} />
        ))}
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
