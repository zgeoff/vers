import path from 'node:path';
import { runServerImageBuilds } from '../ci/run-server-image-builds';

await runServerImageBuilds({
  rootPath: path.resolve(import.meta.dirname, '../../..'),
  writeLine: console.log,
});
