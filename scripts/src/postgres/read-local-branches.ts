import { $ } from 'bun';

export async function readLocalBranches(repoRoot: string): Promise<Array<string>> {
  const branches = await $`git for-each-ref refs/heads --format=%(refname:short)`
    .cwd(repoRoot)
    .text();

  return branches.split('\n').filter((line) => line.length > 0);
}
