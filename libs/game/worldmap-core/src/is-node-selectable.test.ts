import { expect, test } from 'bun:test';
import invariant from 'tiny-invariant';
import { collectNodeEdges } from './collect-node-edges';
import { isNodeSelectable } from './is-node-selectable';
import { toNodeID } from './to-node-id';

const SEED = 2024;

test('it makes the origin selectable with no completed nodes at all', () => {
  expect(isNodeSelectable(SEED, new Set(), toNodeID(0, 0))).toBe(true);
});

test('it keeps a completed node selectable', () => {
  const completed = new Set([toNodeID(5, -3)]);

  expect(isNodeSelectable(SEED, completed, toNodeID(5, -3))).toBe(true);
});

test('it makes a real neighbour of a completed node selectable', () => {
  const completedID = toNodeID(0, 0);

  const completed = new Set([completedID]);

  const [edge] = collectNodeEdges(SEED, 0, 0);

  invariant(edge, 'the origin connects to at least one neighbour');

  const [aID = '', bID = ''] = edge.id.split('|');
  const neighbourID = aID === completedID ? bID : aID;

  expect(isNodeSelectable(SEED, completed, neighbourID)).toBe(true);
});

test('it refuses a node with no completion and no completed neighbour', () => {
  const completed = new Set([toNodeID(0, 0)]);

  expect(isNodeSelectable(SEED, completed, toNodeID(50, 50))).toBe(false);
});

test('it refuses a malformed id', () => {
  expect(isNodeSelectable(SEED, new Set(), 'not_a_node_id')).toBe(false);
});
