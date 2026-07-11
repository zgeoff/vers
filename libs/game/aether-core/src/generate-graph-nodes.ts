import invariant from 'tiny-invariant';
import { createAetherNode } from './create-aether-node';
import type { AetherNode } from './types';

type MutableConnections = [null | string, null | string, null | string, null | string];

/**
 * a node mid-construction: its connections are filled in across two passes
 * before the graph is frozen into the readonly AetherNode shape callers get.
 */
type AetherNodeDraft = Omit<AetherNode, 'connections'> & { connections: MutableConnections };

function toDraftNode(node: AetherNode): AetherNodeDraft {
  return { ...node, connections: [...node.connections] };
}

/**
 * Generates a graph of AetherNodes and returns them as an array.
 *
 * @param maxDifficulty - The maximum difficulty of the graph
 * @returns A graph of AetherNodes
 */
export function generateGraphNodes(maxDifficulty: number): Array<AetherNode> {
  const graph: Array<AetherNodeDraft> = [];

  const centralNode = toDraftNode(createAetherNode(0, 0));

  graph.push(centralNode);

  // generate all the nodes in our graph
  for (let difficulty = 1; difficulty <= maxDifficulty; difficulty++) {
    // linear growth in nodes per difficulty
    const nodesInLevel = 4 * difficulty;

    for (let i = 0; i < nodesInLevel; i++) {
      graph.push(toDraftNode(createAetherNode(i, difficulty)));
    }
  }

  // set all our connections
  for (const [i, node] of graph.entries()) {
    const nodesInCurrentLevel = 4 * node.difficulty;
    const nodesInPreviousLevel = nodesInCurrentLevel - 4;
    const nodesInNextLevel = nodesInCurrentLevel + 4;

    const startIndexOfCurrentLevel = i - node.index;
    const startIndexOfPreviousLevel = startIndexOfCurrentLevel - nodesInPreviousLevel;
    const startIndexOfNextLevel = startIndexOfCurrentLevel + nodesInCurrentLevel;

    // we'll manually attach our origin node at the end
    if (node.difficulty > 0) {
      let prevIndex1: number;
      let prevIndex2: number;
      let nextIndex1: number;
      let nextIndex2: number;

      const segment = Math.floor(node.index / node.difficulty);

      // a good mental model for this is as we get further away from our +X axis (which is represented
      // by our segment), the connections to the next highest difficulty increase in distance, accounting
      // for the linear growth.
      switch (segment) {
        case 0: {
          prevIndex1 = i - nodesInPreviousLevel;
          prevIndex2 = prevIndex1 - 1;
          nextIndex1 = i + nodesInCurrentLevel;
          nextIndex2 = nextIndex1 + 1;

          // if it is the first node of the difficulty, we need to connect to the last node of the next
          if (node.index / node.difficulty === 0) {
            prevIndex2 = startIndexOfNextLevel + nodesInNextLevel - 1;
          }

          break;
        }

        case 1: {
          prevIndex1 = i - nodesInPreviousLevel - 1;
          prevIndex2 = prevIndex1 - 1;
          nextIndex1 = i + nodesInCurrentLevel + 1;
          nextIndex2 = nextIndex1 + 1;

          // we're travelling along our axis, so connect to a the higher difficulty node
          if (node.index / node.difficulty === 1) {
            prevIndex2 = startIndexOfNextLevel + node.index;
          }

          break;
        }

        case 2: {
          prevIndex1 = i - nodesInPreviousLevel - 2;
          prevIndex2 = prevIndex1 - 1;
          nextIndex1 = i + nodesInCurrentLevel + 2;
          nextIndex2 = nextIndex1 + 1;

          // we're travelling along our axis, so connect to a the higher difficulty node
          if (node.index / node.difficulty === 2) {
            prevIndex2 = startIndexOfNextLevel + node.index + 1;
          }

          break;
        }

        case 3: {
          prevIndex1 = i - nodesInPreviousLevel - 3;
          prevIndex2 = prevIndex1 - 1;
          nextIndex1 = i + nodesInCurrentLevel + 3;
          nextIndex2 = nextIndex1 + 1;

          // we're travelling along our axis, so connect to a the higher difficulty node
          if (node.index / node.difficulty === 3) {
            prevIndex2 = startIndexOfNextLevel + node.index + 2;
          }

          // if its the last node of the difficulty, we need to connect to the first node of the previous
          if (node.index + 1 === nodesInCurrentLevel) {
            prevIndex1 = startIndexOfPreviousLevel;
          }

          break;
        }

        default: {
          invariant(false, 'invalid segment');
        }
      }

      const connection1 = graph[prevIndex1];
      const connection2 = graph[prevIndex2];
      const connection3 = graph[nextIndex1];
      const connection4 = graph[nextIndex2];

      node.connections = [
        connection1?.id ?? null,
        connection2?.id ?? null,
        connection3?.id ?? null,
        connection4?.id ?? null,
      ];
    }
  }

  // connect the central node to the first difficulty
  for (let i = 0; i < 4; i++) {
    const node = graph[i + 1];

    invariant(node, 'node is required');

    centralNode.connections[i] = node.id;
    node.connections[0] = centralNode.id;
  }

  return graph.map((node) => ({
    connections: node.connections,
    difficulty: node.difficulty,
    id: node.id,
    index: node.index,
    position: node.position,
    seed: node.seed,
  }));
}
