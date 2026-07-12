import path from 'node:path';
import type { EnvFileManifestEntry, EnvWritePlan } from './types';

/**
 * Resolves each manifest entry's repo-root-relative target into an absolute
 * write plan, pairing it with the item's vault coordinates.
 */
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
