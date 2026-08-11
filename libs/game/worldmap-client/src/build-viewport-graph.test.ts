import { expect, test } from 'bun:test';
import { toNodeID } from '@vers/worldmap-core';
import { buildViewportGraph } from './build-viewport-graph';

const SEED = 7;

test('it carries every cell inside the viewport as a node', () => {
  const graph = buildViewportGraph(SEED, { maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 });

  expect(Object.keys(graph.nodes)).toHaveLength(25);
});

test('it excludes a cell outside the viewport', () => {
  const graph = buildViewportGraph(SEED, { maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 });

  expect(graph.nodes[toNodeID(3, 0)]).toBeUndefined();
});

test('it includes the origin node when the viewport covers it', () => {
  const graph = buildViewportGraph(SEED, { maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 });

  expect(graph.nodes[toNodeID(0, 0)]).toBeDefined();
});

test('it lands every edge on two rendered nodes', () => {
  const graph = buildViewportGraph(SEED, { maxCX: 3, maxCY: 3, minCX: -3, minCY: -3 });

  for (const edge of Object.values(graph.edges)) {
    const [aID = '', bID = ''] = edge.id.split('|');

    expect(graph.nodes[aID]).toBeDefined();
    expect(graph.nodes[bID]).toBeDefined();
  }
});

test('it connects the origin to at least one neighbour', () => {
  const graph = buildViewportGraph(SEED, { maxCX: 3, maxCY: 3, minCX: -3, minCY: -3 });
  const originID = toNodeID(0, 0);

  const incident = Object.values(graph.edges).filter((edge) =>
    edge.id.split('|').includes(originID),
  );

  expect(incident.length).toBeGreaterThan(0);
});

test('it is deterministic for a seed and viewport', () => {
  const viewport = { maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 };

  expect(buildViewportGraph(SEED, viewport)).toStrictEqual(buildViewportGraph(SEED, viewport));
});

test('it lays nodes out differently under a different seed', () => {
  const id = toNodeID(1, 0);
  const viewport = { maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 };

  expect(buildViewportGraph(SEED, viewport).nodes[id]?.position).not.toStrictEqual(
    buildViewportGraph(SEED + 1, viewport).nodes[id]?.position,
  );
});

test('it carries the same node whether a viewport crosses a chunk boundary or not', () => {
  const id = toNodeID(15, 15);
  const withinChunk = buildViewportGraph(SEED, { maxCX: 15, maxCY: 15, minCX: 0, minCY: 0 });
  const acrossChunks = buildViewportGraph(SEED, { maxCX: 20, maxCY: 20, minCX: 10, minCY: 10 });

  expect(withinChunk.nodes[id]).toStrictEqual(acrossChunks.nodes[id]);
});

test('it carries a viewport entirely inside a single negative chunk', () => {
  const graph = buildViewportGraph(SEED, { maxCX: -10, maxCY: -10, minCX: -12, minCY: -12 });

  expect(Object.keys(graph.nodes)).toHaveLength(9);
});
