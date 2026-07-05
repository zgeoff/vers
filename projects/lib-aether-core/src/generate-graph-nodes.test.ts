import type * as GameUtils from '@vers/game-utils';
import { expect, test, vi } from 'vitest';
import { generateGraphNodes } from './generate-graph-nodes';

// mock our ID & seed generation so they return predictable values
vi.mock(import('./create-id'), () => {
  let id = 0;

  const createID = vi.fn<() => string>(() => {
    const result = `id-${id}`;

    id++;

    return result;
  });

  return { createID };
});

vi.mock(import('@vers/game-utils'), async (importOriginal) => {
  const original = await importOriginal<typeof GameUtils>();

  let seed = 0;

  const createSeed = vi.fn<() => number>(() => seed++);

  return {
    ...original,
    createSeed,
  };
});

// rather than testing our implementation, snapshot a valid graph.
// if this changes we need to go over it with a fine tooth comb.
test('it generates a valid graph', () => {
  const nodes = generateGraphNodes(3);

  expect(nodes).toMatchSnapshot();
});

test('it generates a central origin node', () => {
  const nodes = generateGraphNodes(1);

  expect(nodes[0]).toStrictEqual({
    connections: expect.arrayContaining([
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
    ]),
    difficulty: 0,
    id: expect.any(String),
    index: 0,
    position: [0, 0],
    seed: expect.any(Number),
  });
});

test('it generates the correct number of nodes for each difficulty level', () => {
  const nodes = generateGraphNodes(3);

  // 1 + 4 + 8 + 12 = 25
  expect(nodes).toHaveLength(25);

  const difficulty1Nodes = nodes.filter((node) => node.difficulty === 1);
  const difficulty2Nodes = nodes.filter((node) => node.difficulty === 2);
  const difficulty3Nodes = nodes.filter((node) => node.difficulty === 3);

  expect(difficulty1Nodes).toHaveLength(4);
  expect(difficulty2Nodes).toHaveLength(8);
  expect(difficulty3Nodes).toHaveLength(12);
});
