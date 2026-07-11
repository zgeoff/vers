import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateGraphNodes } from './src/generate-graph-nodes';
import { getCompressedAetherGraph } from './src/get-compressed-aether-graph';

const MAX_DIFFICULTY = 100;

const graph = generateGraphNodes(MAX_DIFFICULTY);
const graphData = getCompressedAetherGraph(graph);

const outFileURL = new URL('src/aether-graph.json', import.meta.url);

const outFile = fileURLToPath(outFileURL);

fs.writeFileSync(outFile, JSON.stringify(graphData, null, 2));
