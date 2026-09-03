import path from 'node:path';
import type { EnvFileManifestEntry, EnvWritePlan } from './types';

export function planEnvWrites(
  manifest: ReadonlyArray<EnvFileManifestEntry>,
  repoRoot: string,
): ReadonlyArray<EnvWritePlan> {
  return manifest.map((entry) => ({
    filePath: path.join(repoRoot, entry.targetPath),
    itemTitle: entry.itemTitle,
    vault: entry.vault,
  }));
}
