import { execa } from 'execa';
import { z } from 'zod';
import type { ChangeSet } from './types';

const turboDryRunSchema = z.object({
  packages: z.array(z.string()),
});

/**
 * Collects what changed between a base commit and HEAD: turbo-affected
 * workspace packages plus raw changed paths. Returns null when the repo
 * doesn't contain the base commit (rewritten history, shallow clone) so
 * callers treat the target as stale rather than silently current.
 */
export async function readChangesSince(baseSHA: string): Promise<ChangeSet | null> {
  const baseExists = await execa('git', ['cat-file', '-e', `${baseSHA}^{commit}`], {
    reject: false,
  });

  if (baseExists.exitCode !== 0) {
    return null;
  }

  const diff = await execa('git', ['diff', '--name-only', baseSHA, 'HEAD']);

  const changedPaths = diff.stdout.split('\n').filter(Boolean);

  const dryRun = await execa('turbo', ['run', 'build', '--affected', '--dry=json'], {
    env: { TURBO_SCM_BASE: baseSHA },
    preferLocal: true,
  });

  const affectedPkgs = turboDryRunSchema.parse(JSON.parse(dryRun.stdout)).packages;

  return { affectedPkgs, changedPaths };
}
