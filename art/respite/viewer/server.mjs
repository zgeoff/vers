import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, resolve, sep } from 'node:path';

const localRequire = createRequire(resolve(import.meta.dirname, 'package.json'));
let threeRoot;
let controlsRoot;
try {
  threeRoot = resolve(dirname(localRequire.resolve('three')), '..');
  controlsRoot = dirname(localRequire.resolve('camera-controls'));
} catch {
  const project = resolve(import.meta.dirname, '../../..');
  const commonGit = execFileSync('git', ['rev-parse', '--git-common-dir'], {
    cwd: project,
    encoding: 'utf8',
  }).trim();
  const repo = dirname(resolve(project, commonGit));
  const require = createRequire(resolve(repo, 'apps/web/package.json'));
  threeRoot = resolve(dirname(require.resolve('three')), '..');
  const controlsRequire = createRequire(resolve(repo, 'libs/game/worldmap-client/package.json'));
  controlsRoot = dirname(controlsRequire.resolve('camera-controls'));
}
const exportRoot = resolve(import.meta.dirname, '../exports');
const types = {
  '.html': 'text/html',
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
};

createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let root = import.meta.dirname;
    let relative = path === '/' ? 'index.html' : path.slice(1);
    if (path.startsWith('/three/')) {
      root = threeRoot;
      relative = path.slice(7);
    } else if (path.startsWith('/exports/')) {
      root = exportRoot;
      relative = path.slice(9);
    } else if (path === '/camera-controls.js') {
      root = controlsRoot;
      relative = 'camera-controls.module.js';
    }
    const file = resolve(root, relative);
    if (!file.startsWith(resolve(root) + sep) || request.method !== 'GET') {
      response.writeHead(403).end();
      return;
    }
    const info = await stat(file);
    if (!info.isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    const contents = await readFile(file);
    response.end(contents);
  } catch (error) {
    const status = error.code === 'ENOENT' ? 404 : 500;
    response.writeHead(status).end('Asset unavailable');
  }
}).listen(4599, '0.0.0.0', () => console.log('Respite preview: http://localhost:4599'));
