import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildGraphNodes } from './src/build-graph-nodes';
import { compressWorldMapNodes } from './src/compress-world-map-nodes';

const MAX_DIFFICULTY = 100;
const graph = buildGraphNodes(MAX_DIFFICULTY);
const graphData = compressWorldMapNodes(graph);

const outFileURL = new URL('src/world-graph.json', import.meta.url);

const outFile = fileURLToPath(outFileURL);

fs.writeFileSync(outFile, JSON.stringify(graphData, null, 2));
