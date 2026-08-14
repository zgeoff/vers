import { expect, test } from 'bun:test';
import type { WorldEdge } from '@vers/worldmap-core';
import { toNodeID } from '@vers/worldmap-core';
import invariant from 'tiny-invariant';
import { buildViewportGraph } from './build-viewport-graph';

test('it pins the frozen golden graph for a hand-written viewport', () => {
  expect(buildViewportGraph(7, { maxCX: 1, maxCY: 1, minCX: 0, minCY: 0 })).toMatchInlineSnapshot(`
    {
      "edges": {
        "0_0|0_1": {
          "endPosition": [
            0.8443913956078138,
            1.1333863789215683,
          ],
          "id": "0_0|0_1",
          "startPosition": [
            0.268604114279151,
            0.089944507740438,
          ],
        },
        "0_0|1_0": {
          "endPosition": [
            1.457924700136929,
            0.3155496230348945,
          ],
          "id": "0_0|1_0",
          "startPosition": [
            0.268604114279151,
            0.089944507740438,
          ],
        },
        "0_1|1_0": {
          "endPosition": [
            0.8443913956078138,
            1.1333863789215683,
          ],
          "id": "0_1|1_0",
          "startPosition": [
            1.457924700136929,
            0.3155496230348945,
          ],
        },
        "0_1|1_1": {
          "endPosition": [
            2.528288197023346,
            1.8942371850833297,
          ],
          "id": "0_1|1_1",
          "startPosition": [
            0.8443913956078138,
            1.1333863789215683,
          ],
        },
        "1_0|1_1": {
          "endPosition": [
            2.528288197023346,
            1.8942371850833297,
          ],
          "id": "1_0|1_1",
          "startPosition": [
            1.457924700136929,
            0.3155496230348945,
          ],
        },
      },
      "nodes": {
        "0_0": {
          "coord": [
            0,
            0,
          ],
          "difficulty": 0,
          "id": "0_0",
          "position": [
            0.268604114279151,
            0.089944507740438,
          ],
        },
        "0_1": {
          "coord": [
            0,
            1,
          ],
          "difficulty": 1,
          "id": "0_1",
          "position": [
            0.8443913956078138,
            1.1333863789215683,
          ],
        },
        "1_0": {
          "coord": [
            1,
            0,
          ],
          "difficulty": 1,
          "id": "1_0",
          "position": [
            1.457924700136929,
            0.3155496230348945,
          ],
        },
        "1_1": {
          "coord": [
            1,
            1,
          ],
          "difficulty": 2,
          "id": "1_1",
          "position": [
            2.528288197023346,
            1.8942371850833297,
          ],
        },
      },
    }
  `);
});

test('it carries every cell inside the viewport as a node', () => {
  const graph = buildViewportGraph(7, { maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 });

  expect(Object.keys(graph.nodes)).toHaveLength(25);
});

test('it excludes a cell outside the viewport', () => {
  const graph = buildViewportGraph(7, { maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 });

  expect(graph.nodes[toNodeID(3, 0)]).toBeUndefined();
});

test('it includes the origin node when the viewport covers it', () => {
  const graph = buildViewportGraph(7, { maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 });

  expect(graph.nodes[toNodeID(0, 0)]).toBeDefined();
});

test('it lands every edge on two rendered nodes', () => {
  const graph = buildViewportGraph(7, { maxCX: 3, maxCY: 3, minCX: -3, minCY: -3 });

  expect(Object.values(graph.edges)).toSatisfyAll((edge: WorldEdge) => {
    const [aID = '', bID = ''] = edge.id.split('|');

    return graph.nodes[aID] !== undefined && graph.nodes[bID] !== undefined;
  });
});

test('it connects the origin to at least one neighbour', () => {
  const graph = buildViewportGraph(7, { maxCX: 3, maxCY: 3, minCX: -3, minCY: -3 });
  const originID = toNodeID(0, 0);

  const incident = Object.values(graph.edges).filter((edge) =>
    edge.id.split('|').includes(originID),
  );

  expect(incident.length).toBeGreaterThan(0);
});

test('it is deterministic for a seed and viewport', () => {
  const viewport = { maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 };

  expect(buildViewportGraph(7, viewport)).toStrictEqual(buildViewportGraph(7, viewport));
});

test('it lays nodes out differently under a different seed', () => {
  const id = toNodeID(1, 0);
  const viewport = { maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 };
  const first = buildViewportGraph(7, viewport).nodes[id];
  const second = buildViewportGraph(8, viewport).nodes[id];

  invariant(first && second, 'both seeds generate the cell inside the viewport');

  expect(first.position).not.toStrictEqual(second.position);
});

test('it carries the same node whether a viewport crosses a chunk boundary or not', () => {
  const id = toNodeID(15, 15);
  const withinChunk = buildViewportGraph(7, { maxCX: 15, maxCY: 15, minCX: 0, minCY: 0 });
  const acrossChunks = buildViewportGraph(7, { maxCX: 20, maxCY: 20, minCX: 10, minCY: 10 });

  expect(withinChunk.nodes[id]).toStrictEqual(acrossChunks.nodes[id]);
});

test('it carries a viewport entirely inside a single negative chunk', () => {
  const graph = buildViewportGraph(7, { maxCX: -10, maxCY: -10, minCX: -12, minCY: -12 });

  expect(Object.keys(graph.nodes)).toHaveLength(9);
});
