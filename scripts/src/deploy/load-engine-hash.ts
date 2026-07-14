import { createHash } from 'node:crypto';
import path from 'node:path';

/**
 * Matches `ARG BUN_VERSION` in every service Dockerfile — the runtime the
 * hashed bundle is deployed to. A hash built under a different Bun version
 * isn't comparable across environments, so `loadEngineHash` refuses to run
 * under any other version.
 */
export const PINNED_BUN_VERSION = '1.3.10';

const DEFAULT_ENTRYPOINT = path.resolve(
  import.meta.dirname,
  '../../../libs/game/idle-core/src/replay.ts',
);

/**
 * The sim version identity: a sha256 hex digest over the pure replay
 * entrypoint's bundled output plus the pinned Bun version, so any change to
 * the engine's transitive closure or its build runtime changes the hash. The
 * bundle build is deterministic (`target: 'bun'`, unminified, no sourcemap)
 * so two builds of the same closure agree.
 */
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
