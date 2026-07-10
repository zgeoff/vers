import { rmSync, writeFileSync } from 'node:fs';

/**
 * knip's Vite/Vitest/Ladle plugins insist on loading a root `vite.config.ts`, but the isolated
 * linker keeps `vite` out of the root's `node_modules`, so the load throws and aborts the run.
 * A dependency-free stub written for the duration of the run satisfies the loader without
 * committing a stray config file; it is removed whether knip passes or fails.
 */
const stubURL = new URL('../vite.config.ts', import.meta.url);

writeFileSync(stubURL, 'export default {};\n');

let exitCode = 0;

try {
  const result = Bun.spawnSync(['bunx', 'knip', ...Bun.argv.slice(2)], {
    stderr: 'inherit',
    stdin: 'inherit',
    stdout: 'inherit',
  });

  exitCode = result.exitCode ?? 1;
} finally {
  rmSync(stubURL, { force: true });
}

process.exit(exitCode);
