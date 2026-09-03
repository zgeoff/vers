import { execa } from 'execa';
import { z } from 'zod';
import { makeContextExcluder } from './make-context-excluder';
import { parseDockerignore } from './parse-dockerignore';
import { readCommitRelation } from './read-commit-relation';
import type { ChangeSet } from './types';

const turboDryRunSchema = z.object({
  packages: z.array(z.string()),
});

export async function readChangesSince(baseSHA: string): Promise<ChangeSet | null> {
  const relation = await readCommitRelation(baseSHA);

  if (relation === 'missing') {
    return null;
  }

  if (relation === 'same' || relation === 'descendant') {
    return { affectedPkgs: [], changedPaths: [] };
  }

  const [diff, isExcluded] = await Promise.all([
    execa('git', ['diff', '--name-only', baseSHA, 'HEAD']),
    readContextExcluder(),
  ]);

  const changedPaths = diff.stdout.split('\n').filter((path) => path !== '' && !isExcluded(path));

  const dryRun = await execa('turbo', ['run', 'build', '--affected', '--dry=json'], {
    env: { TURBO_SCM_BASE: baseSHA },
    preferLocal: true,
  });

  const affectedPkgs = turboDryRunSchema.parse(JSON.parse(dryRun.stdout)).packages;

  return { affectedPkgs, changedPaths };
}

async function readContextExcluder(): Promise<(path: string) => boolean> {
  const file = Bun.file('.dockerignore');

  const exists = await file.exists();

  const text = exists ? await file.text() : '';

  return makeContextExcluder(parseDockerignore(text));
}
