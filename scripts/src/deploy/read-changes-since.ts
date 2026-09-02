import { execa } from 'execa';
import { z } from 'zod';
import type { ChangeSet } from './types';

const turboDryRunSchema = z.object({
  packages: z.array(z.string()),
});

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
