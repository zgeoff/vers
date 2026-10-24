import { $ } from 'bun';
import type { CommitRelation } from './types';

interface ReadCommitRelationOptions {
  readonly cwd?: string;
}

export async function readCommitRelation(
  baseSHA: string,
  options?: ReadCommitRelationOptions,
): Promise<CommitRelation> {
  const cwd = options?.cwd ?? process.cwd();

  const baseExists = await $`git cat-file -e ${`${baseSHA}^{commit}`}`.cwd(cwd).nothrow().quiet();

  if (baseExists.exitCode !== 0) {
    return 'missing';
  }

  const [baseIsAncestor, headIsAncestor] = await Promise.all([
    probeAncestor(baseSHA, 'HEAD', cwd),
    probeAncestor('HEAD', baseSHA, cwd),
  ]);

  if (baseIsAncestor && headIsAncestor) {
    return 'same';
  }

  if (baseIsAncestor) {
    return 'ancestor';
  }

  if (headIsAncestor) {
    return 'descendant';
  }

  return 'diverged';
}

async function probeAncestor(older: string, newer: string, cwd: string): Promise<boolean> {
  const result = await $`git merge-base --is-ancestor ${older} ${newer}`.cwd(cwd).nothrow().quiet();

  return result.exitCode === 0;
}
