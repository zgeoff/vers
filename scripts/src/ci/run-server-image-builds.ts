import path from 'node:path';
import { $, Glob } from 'bun';

interface ServerImageBuildOptions {
  readonly rootPath: string;
  readonly writeLine: (line: string) => void;
}

export async function runServerImageBuilds(
  options: Readonly<ServerImageBuildOptions>,
): Promise<void> {
  const flyConfigs = await Array.fromAsync(
    new Glob('services/*/fly.toml').scan({ cwd: options.rootPath }),
  );

  const services = flyConfigs.map((config) => path.basename(path.dirname(config))).toSorted();

  options.writeLine('::group::apps/web');

  await $`docker build --file apps/web/Dockerfile .`.cwd(options.rootPath);

  options.writeLine('::endgroup::');

  for (const service of services) {
    options.writeLine(`::group::services/${service}`);

    await $`docker build --file services/Dockerfile --build-arg SERVICE=${service} .`.cwd(
      options.rootPath,
    );

    options.writeLine('::endgroup::');
  }
}
