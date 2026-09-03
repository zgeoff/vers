import { execa } from 'execa';
import type { CommitRelation } from './types';

interface ReadCommitRelationOptions {
  readonly cwd?: string;
}

export async function readCommitRelation(
  baseSHA: string,
  options?: ReadCommitRelationOptions,
): Promise<CommitRelation> {
  const cwd = options?.cwd ?? process.cwd();

  const baseExists = await execa('git', ['cat-file', '-e', `${baseSHA}^{commit}`], {
    cwd,
    reject: false,
  });

  if (baseExists.exitCode !== 0) {
    return 'missing';
  }

  const [baseIsAncestor, headIsAncestor] = await Promise.all([
    isAncestor(baseSHA, 'HEAD', cwd),
    isAncestor('HEAD', baseSHA, cwd),
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

async function isAncestor(older: string, newer: string, cwd: string): Promise<boolean> {
  const result = await execa('git', ['merge-base', '--is-ancestor', older, newer], {
    cwd,
    reject: false,
  });

  return result.exitCode === 0;
}
