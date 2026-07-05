import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

/**
 * Bundles a service's entry point with esbuild, driven by the project's own
 * `esbuild.config.cjs` (entry point, external packages, sourcemap, banner,
 * plugins). Run with cwd set to the project directory — every path below is
 * resolved relative to it.
 *
 * Usage: bun ../../scripts/build-esbuild.ts (from a project directory)
 */
interface ServiceBuildConfig {
  assets?: Array<string>;
  banner?: Record<string, string>;
  entryPoint: string;
  external?: Array<string>;
  plugins?: Array<esbuild.Plugin>;
  sourcemap?: boolean;
}

const projectDir = process.cwd();
const configPath = path.join(projectDir, 'esbuild.config.cjs');

// oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
const configModule = await import(configPath);
// oxlint-disable-next-line typescript/no-unsafe-member-access, typescript/no-unsafe-type-assertion -- baseline(#236)
const config = configModule.default as ServiceBuildConfig;

const outdir = path.join(projectDir, 'dist');

fs.rmSync(outdir, { force: true, recursive: true });

await esbuild.build({
  ...(config.banner !== undefined && { banner: config.banner }),
  bundle: true,
  entryPoints: [config.entryPoint],
  external: config.external ?? [],
  format: 'esm',
  outdir,
  platform: 'node',
  plugins: config.plugins ?? [],
  sourcemap: config.sourcemap ?? false,
  tsconfig: path.join(projectDir, 'tsconfig.app.json'),
});

for (const assetDir of config.assets ?? []) {
  const from = path.join(projectDir, assetDir);

  if (fs.existsSync(from)) {
    fs.cpSync(from, path.join(outdir, path.basename(assetDir)), {
      recursive: true,
    });
  }
}

// node needs a package.json alongside the bundle to know it's ESM; runtime
// deps come from the workspace install (turbo prune scopes it in Docker),
// so this manifest carries no dependencies of its own
fs.writeFileSync(
  path.join(outdir, 'package.json'),
  JSON.stringify({ name: 'main', private: true, type: 'module' }, null, 2),
);
