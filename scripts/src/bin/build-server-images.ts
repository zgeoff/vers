import path from 'node:path';
import { runServerImageBuilds } from '../ci/run-server-image-builds';

// Builds the web image and every service image from the repo root, as the deploy builds them, so a
// change to an install stage's inputs fails before it merges.

await runServerImageBuilds({
  rootPath: path.resolve(import.meta.dirname, '../../..'),
  writeLine: console.log,
});
