import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateGraphNodes } from './src/generate-graph-nodes';
import { getCompressedWorldGraph } from './src/get-compressed-world-graph';

const MAX_DIFFICULTY = 100;
const graph = generateGraphNodes(MAX_DIFFICULTY);
const graphData = getCompressedWorldGraph(graph);

const outFileURL = new URL('src/world-graph.json', import.meta.url);

const outFile = fileURLToPath(outFileURL);

fs.writeFileSync(outFile, JSON.stringify(graphData, null, 2));
