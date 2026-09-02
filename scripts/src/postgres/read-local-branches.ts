import { execa } from 'execa';

export async function readLocalBranches(repoRoot: string): Promise<Array<string>> {
  const result = await execa('git', ['for-each-ref', 'refs/heads', '--format=%(refname:short)'], {
    cwd: repoRoot,
  });

  return result.stdout.split('\n').filter((line) => line.length > 0);
}
