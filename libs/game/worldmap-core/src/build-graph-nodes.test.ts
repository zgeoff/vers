import { expect, spyOn, test } from 'bun:test';
import * as gameUtils from '@vers/game-utils';
import { buildGraphNodes } from './build-graph-nodes';
import * as createIdModule from './create-id';

// rather than testing our implementation, snapshot a valid graph.
// if this changes we need to go over it with a fine tooth comb.
test('it generates a valid graph', () => {
  // spy ID & seed generation so they return predictable values for the snapshot
  let id = 0;

  spyOn(createIdModule, 'createID').mockImplementation(() => {
    const result = `id-${id}`;

    id++;

    return result;
  });

  let seed = 0;

  spyOn(gameUtils, 'createSeed').mockImplementation(() => seed++);

  const nodes = buildGraphNodes(3);

  expect(nodes).toMatchSnapshot();
});

test('it generates a central origin node', () => {
  const nodes = buildGraphNodes(1);

  expect(nodes[0]).toStrictEqual({
    connections: [
      expect.toBeString(),
      expect.toBeString(),
      expect.toBeString(),
      expect.toBeString(),
    ],
    difficulty: 0,
    id: expect.toBeString(),
    index: 0,
    position: [0, 0],
    seed: expect.toBeNumber(),
  });
});

test('it generates the correct number of nodes for each difficulty level', () => {
  const nodes = buildGraphNodes(3);

  // 1 + 4 + 8 + 12 = 25
  expect(nodes).toHaveLength(25);

  const difficulty1Nodes = nodes.filter((node) => node.difficulty === 1);
  const difficulty2Nodes = nodes.filter((node) => node.difficulty === 2);
  const difficulty3Nodes = nodes.filter((node) => node.difficulty === 3);

  expect(difficulty1Nodes).toHaveLength(4);
  expect(difficulty2Nodes).toHaveLength(8);
  expect(difficulty3Nodes).toHaveLength(12);
});
