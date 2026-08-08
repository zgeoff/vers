import { expect, test } from 'bun:test';
import { toNodeID } from '@vers/worldmap-core';
import { buildRegionGraph } from './build-region-graph';

const SEED = 7;

test('it carries every cell within the radius as a node', () => {
  const graph = buildRegionGraph(SEED, 2);

  // a hex disc of radius r holds 1 + 3r(r+1) cells
  expect(Object.keys(graph.nodes)).toHaveLength(1 + 3 * 2 * 3);
});

test('it includes the origin node', () => {
  const graph = buildRegionGraph(SEED, 2);

  expect(graph.nodes[toNodeID(0, 0)]).toBeDefined();
});

test('it lands every edge on two rendered nodes', () => {
  const graph = buildRegionGraph(SEED, 3);

  for (const edge of Object.values(graph.edges)) {
    const [aID = '', bID = ''] = edge.id.split('|');

    expect(graph.nodes[aID]).toBeDefined();
    expect(graph.nodes[bID]).toBeDefined();
  }
});

test('it connects the origin to at least one neighbour', () => {
  const graph = buildRegionGraph(SEED, 3);
  const originID = toNodeID(0, 0);

  const incident = Object.values(graph.edges).filter((edge) =>
    edge.id.split('|').includes(originID),
  );

  expect(incident.length).toBeGreaterThan(0);
});

test('it is deterministic for a seed and radius', () => {
  expect(buildRegionGraph(SEED, 2)).toStrictEqual(buildRegionGraph(SEED, 2));
});

test('it lays nodes out differently under a different seed', () => {
  const id = toNodeID(1, 0);

  expect(buildRegionGraph(SEED, 2).nodes[id]?.position).not.toStrictEqual(
    buildRegionGraph(SEED + 1, 2).nodes[id]?.position,
  );
});

test('it rejects a non-integer radius', () => {
  expect(() => buildRegionGraph(SEED, 2.5)).toThrow('non-negative integer');
});
