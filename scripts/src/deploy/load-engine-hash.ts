import { createHash } from 'node:crypto';
import path from 'node:path';

// matches `ARG BUN_VERSION` in every service Dockerfile: a hash built under another Bun version
// is not comparable across environments
export const PINNED_BUN_VERSION = '1.3.10';

const DEFAULT_ENTRYPOINT = path.resolve(
  import.meta.dirname,
  '../../../libs/game/idle-core/src/replay.ts',
);

export async function loadEngineHash(entrypoint: string = DEFAULT_ENTRYPOINT): Promise<string> {
  requirePinnedBunVersion();

  const result = await Bun.build({
    entrypoints: [entrypoint],
    minify: false,
    sourcemap: 'none',
    target: 'bun',
  });

  if (!result.success) {
    const messages = result.logs.map((log) => log.message).join('\n');

    throw new Error(`failed to build the engine bundle for hashing:\n${messages}`);
  }

  const outputs = await Promise.all(
    result.outputs.map(async (output) => ({ path: output.path, text: await output.text() })),
  );

  outputs.sort((a, b) => a.path.localeCompare(b.path));

  const hash = createHash('sha256');

  for (const output of outputs) {
    hash.update(output.text);
  }

  hash.update(`\nbun:${PINNED_BUN_VERSION}`);

  return hash.digest('hex');
}

function requirePinnedBunVersion(): void {
  if (Bun.version !== PINNED_BUN_VERSION) {
    throw new Error(
      `the engine hash requires bun ${PINNED_BUN_VERSION} to be comparable across environments, but this process is running bun ${Bun.version}`,
    );
  }
}
