import { execa } from 'execa';

/**
 * Local branch names via `git for-each-ref`. Branches checked out in
 * worktrees are local heads, so this covers every worktree without walking
 * .worktrees/ itself.
 */
export async function readLocalBranches(repoRoot: string): Promise<Array<string>> {
  const result = await execa('git', ['for-each-ref', 'refs/heads', '--format=%(refname:short)'], {
    cwd: repoRoot,
  });

  return result.stdout.split('\n').filter((line) => line.length > 0);
}
